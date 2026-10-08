// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
package app.nutrimaison

import android.content.Intent
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.MealType
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Percentage
import androidx.health.connect.client.units.Volume
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import kotlin.reflect.KClass

/**
 * Pont Health Connect pour NutriMaison.
 *
 * Anti-doublon :
 *  - chaque enregistrement écrit porte un clientRecordId stable ("nm_food_<id>", "nm_water_<date>"…) :
 *    Health Connect remplace l'existant au lieu de créer un doublon (si clientRecordVersion est plus grand) ;
 *  - les lectures excluent les données écrites par NutriMaison elle-même ;
 *  - les totaux (pas, calories) passent par aggregate(), qui dédoublonne entre sources selon les priorités
 *    réglées dans Health Connect.
 */
@CapacitorPlugin(name = "HealthBridge")
class HealthBridgePlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val client: HealthConnectClient by lazy { HealthConnectClient.getOrCreate(context) }

    private val types: Map<String, KClass<out Record>> = mapOf(
        "steps" to StepsRecord::class,
        "weight" to WeightRecord::class,
        "bodyFat" to BodyFatRecord::class,
        "nutrition" to NutritionRecord::class,
        "hydration" to HydrationRecord::class,
        "exercise" to ExerciseSessionRecord::class,
        "activeCalories" to ActiveCaloriesBurnedRecord::class,
        "totalCalories" to TotalCaloriesBurnedRecord::class,
    )

    /* ---------------------------------------------------------------- */
    /* Disponibilité et permissions                                     */
    /* ---------------------------------------------------------------- */
    @PluginMethod
    fun availability(call: PluginCall) {
        val status = when (HealthConnectClient.getSdkStatus(context)) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
            else -> "unavailable"
        }
        call.resolve(JSObject().put("status", status))
    }

    private fun permissionsFrom(call: PluginCall): Set<String> {
        val out = mutableSetOf<String>()
        call.getArray("read", JSArray())?.let { arr ->
            for (i in 0 until arr.length()) types[arr.getString(i)]?.let { out.add(HealthPermission.getReadPermission(it)) }
        }
        call.getArray("write", JSArray())?.let { arr ->
            for (i in 0 until arr.length()) types[arr.getString(i)]?.let { out.add(HealthPermission.getWritePermission(it)) }
        }
        return out
    }

    private fun grantedToJs(granted: Set<String>): JSObject {
        val read = JSArray()
        val write = JSArray()
        types.forEach { (name, cls) ->
            if (granted.contains(HealthPermission.getReadPermission(cls))) read.put(name)
            if (granted.contains(HealthPermission.getWritePermission(cls))) write.put(name)
        }
        return JSObject().put("read", read).put("write", write)
    }

    @PluginMethod
    fun getGranted(call: PluginCall) {
        scope.launch {
            try {
                call.resolve(grantedToJs(client.permissionController.getGrantedPermissions()))
            } catch (e: Exception) { call.reject(e.message ?: "getGranted") }
        }
    }

    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        try {
            val perms = permissionsFrom(call)
            val intent: Intent = PermissionController.createRequestPermissionResultContract().createIntent(context, perms)
            startActivityForResult(call, intent, "onPermissionsResult")
        } catch (e: Exception) { call.reject(e.message ?: "requestAuthorization") }
    }

    @ActivityCallback
    private fun onPermissionsResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try {
                call.resolve(grantedToJs(client.permissionController.getGrantedPermissions()))
            } catch (e: Exception) { call.reject(e.message ?: "permissions") }
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        try {
            val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) { call.reject(e.message ?: "openSettings") }
    }

    /* ---------------------------------------------------------------- */
    /* Écriture (upsert grâce au clientRecordId)                         */
    /* ---------------------------------------------------------------- */
    private fun inst(ms: Long): Instant = Instant.ofEpochMilli(ms)
    private fun off(i: Instant): ZoneOffset = ZoneId.systemDefault().rules.getOffset(i)
    private fun meta(o: JSONObject): Metadata =
        Metadata.manualEntry(clientRecordId = o.getString("cid"), clientRecordVersion = o.optLong("version", 1L))

    private fun mealType(m: String?): Int = when (m) {
        "petitdej" -> MealType.MEAL_TYPE_BREAKFAST
        "dejeuner" -> MealType.MEAL_TYPE_LUNCH
        "diner" -> MealType.MEAL_TYPE_DINNER
        "collation" -> MealType.MEAL_TYPE_SNACK
        else -> MealType.MEAL_TYPE_UNKNOWN
    }

    private fun exerciseType(t: String?): Int = when (t) {
        "boxing" -> ExerciseSessionRecord.EXERCISE_TYPE_BOXING
        "martial_arts" -> ExerciseSessionRecord.EXERCISE_TYPE_MARTIAL_ARTS
        "strength" -> ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
        "calisthenics" -> ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS
        "hiit" -> ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING
        "running" -> ExerciseSessionRecord.EXERCISE_TYPE_RUNNING
        "walking" -> ExerciseSessionRecord.EXERCISE_TYPE_WALKING
        "hiking" -> ExerciseSessionRecord.EXERCISE_TYPE_HIKING
        "biking" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING
        "biking_stationary" -> ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY
        "swimming" -> ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL
        "yoga" -> ExerciseSessionRecord.EXERCISE_TYPE_YOGA
        "pilates" -> ExerciseSessionRecord.EXERCISE_TYPE_PILATES
        "stretching" -> ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING
        "elliptical" -> ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL
        "rowing" -> ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE
        "dancing" -> ExerciseSessionRecord.EXERCISE_TYPE_DANCING
        "soccer" -> ExerciseSessionRecord.EXERCISE_TYPE_SOCCER
        "basketball" -> ExerciseSessionRecord.EXERCISE_TYPE_BASKETBALL
        "tennis" -> ExerciseSessionRecord.EXERCISE_TYPE_TENNIS
        "badminton" -> ExerciseSessionRecord.EXERCISE_TYPE_BADMINTON
        "squash" -> ExerciseSessionRecord.EXERCISE_TYPE_SQUASH
        "climbing" -> ExerciseSessionRecord.EXERCISE_TYPE_ROCK_CLIMBING
        else -> ExerciseSessionRecord.EXERCISE_TYPE_OTHER_WORKOUT
    }

    private fun buildRecords(kind: String, arr: JSArray): List<Record> {
        val out = mutableListOf<Record>()
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            when (kind) {
                "nutrition" -> {
                    val s = inst(o.getLong("start")); val e = inst(o.getLong("end"))
                    out.add(NutritionRecord(
                        startTime = s, startZoneOffset = off(s), endTime = e, endZoneOffset = off(e),
                        metadata = meta(o),
                        name = o.optString("name").take(100).ifEmpty { null },
                        mealType = mealType(o.optString("meal")),
                        energy = Energy.kilocalories(o.optDouble("kcal", 0.0)),
                        protein = Mass.grams(o.optDouble("prot", 0.0)),
                        totalCarbohydrate = Mass.grams(o.optDouble("carbs", 0.0)),
                        totalFat = Mass.grams(o.optDouble("fat", 0.0)),
                    ))
                }
                "hydration" -> {
                    val s = inst(o.getLong("start")); val e = inst(o.getLong("end"))
                    out.add(HydrationRecord(
                        startTime = s, startZoneOffset = off(s), endTime = e, endZoneOffset = off(e),
                        volume = Volume.milliliters(o.getDouble("ml")), metadata = meta(o),
                    ))
                }
                "exercise" -> {
                    val s = inst(o.getLong("start")); val e = inst(o.getLong("end"))
                    out.add(ExerciseSessionRecord(
                        startTime = s, startZoneOffset = off(s), endTime = e, endZoneOffset = off(e),
                        metadata = meta(o), exerciseType = exerciseType(o.optString("type")),
                        title = o.optString("title").take(100).ifEmpty { null },
                        notes = "NutriMaison",
                    ))
                }
                "activeCalories" -> {
                    val s = inst(o.getLong("start")); val e = inst(o.getLong("end"))
                    out.add(ActiveCaloriesBurnedRecord(
                        startTime = s, startZoneOffset = off(s), endTime = e, endZoneOffset = off(e),
                        energy = Energy.kilocalories(o.getDouble("kcal")), metadata = meta(o),
                    ))
                }
                "weight" -> {
                    val t = inst(o.getLong("time"))
                    out.add(WeightRecord(time = t, zoneOffset = off(t), weight = Mass.kilograms(o.getDouble("kg")), metadata = meta(o)))
                }
                "bodyFat" -> {
                    val t = inst(o.getLong("time"))
                    out.add(BodyFatRecord(time = t, zoneOffset = off(t), percentage = Percentage(o.getDouble("percent")), metadata = meta(o)))
                }
            }
        }
        return out
    }

    /** { kind: "nutrition"|"hydration"|"exercise"|"activeCalories"|"weight"|"bodyFat", records: [...] } */
    @PluginMethod
    fun upsert(call: PluginCall) {
        val kind = call.getString("kind") ?: return call.reject("kind manquant")
        val arr = call.getArray("records", JSArray()) ?: JSArray()
        scope.launch {
            try {
                val records = buildRecords(kind, arr)
                if (records.isNotEmpty()) {
                    // par paquets pour rester sous les limites d'Health Connect
                    records.chunked(500).forEach { client.insertRecords(it) }
                }
                call.resolve(JSObject().put("written", records.size))
            } catch (e: Exception) { call.reject(e.message ?: "upsert") }
        }
    }

    /** { kind, cids: ["nm_food_…", …] } — supprime ce que NutriMaison avait écrit. */
    @PluginMethod
    fun deleteByClientIds(call: PluginCall) {
        val kind = call.getString("kind") ?: return call.reject("kind manquant")
        val cls = types[kind] ?: return call.reject("type inconnu")
        val arr = call.getArray("cids", JSArray()) ?: JSArray()
        val cids = (0 until arr.length()).map { arr.getString(it) }
        scope.launch {
            try {
                if (cids.isNotEmpty()) cids.chunked(500).forEach { client.deleteRecords(cls, emptyList(), it) }
                call.resolve(JSObject().put("deleted", cids.size))
            } catch (e: Exception) { call.reject(e.message ?: "delete") }
        }
    }

    /* ---------------------------------------------------------------- */
    /* Lecture                                                          */
    /* ---------------------------------------------------------------- */
    /** { start, end, metrics: ["steps","activeCalories","totalCalories"] } → totaux dédoublonnés */
    @PluginMethod
    fun aggregate(call: PluginCall) {
        val start = inst(call.getLong("start") ?: return call.reject("start"))
        val end = inst(call.getLong("end") ?: return call.reject("end"))
        val wanted = call.getArray("metrics", JSArray())!!.let { a -> (0 until a.length()).map { a.getString(it) } }
        scope.launch {
            try {
                if (wanted.isEmpty()) { call.resolve(JSObject()); return@launch }
                val metrics: Set<AggregateMetric<*>> = buildSet<AggregateMetric<*>> {
                    if ("steps" in wanted) add(StepsRecord.COUNT_TOTAL)
                    if ("activeCalories" in wanted) add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
                    if ("totalCalories" in wanted) add(TotalCaloriesBurnedRecord.ENERGY_TOTAL)
                }
                val r = client.aggregate(AggregateRequest(metrics = metrics, timeRangeFilter = TimeRangeFilter.between(start, end)))
                val res = JSObject()
                r[StepsRecord.COUNT_TOTAL]?.let { res.put("steps", it) }
                r[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { res.put("activeCalories", it.inKilocalories) }
                r[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.let { res.put("totalCalories", it.inKilocalories) }
                val origins = JSArray()
                r.dataOrigins.forEach { origins.put(it.packageName) }
                res.put("origins", origins)
                call.resolve(res)
            } catch (e: Exception) { call.reject(e.message ?: "aggregate") }
        }
    }

    /** { start, end } → pesées des AUTRES applis (Withings…), jamais celles de NutriMaison */
    @PluginMethod
    fun readWeights(call: PluginCall) {
        val start = inst(call.getLong("start") ?: return call.reject("start"))
        val end = inst(call.getLong("end") ?: return call.reject("end"))
        scope.launch {
            try {
                val resp = client.readRecords(ReadRecordsRequest(WeightRecord::class, TimeRangeFilter.between(start, end)))
                val out = JSArray()
                resp.records.filter { it.metadata.dataOrigin.packageName != context.packageName }.forEach {
                    out.put(JSObject().put("time", it.time.toEpochMilli()).put("kg", it.weight.inKilograms).put("origin", it.metadata.dataOrigin.packageName))
                }
                call.resolve(JSObject().put("records", out))
            } catch (e: Exception) { call.reject(e.message ?: "readWeights") }
        }
    }

    /** { start, end } → séances des AUTRES applis (Fitbit, montre…) */
    @PluginMethod
    fun readExercises(call: PluginCall) {
        val start = inst(call.getLong("start") ?: return call.reject("start"))
        val end = inst(call.getLong("end") ?: return call.reject("end"))
        scope.launch {
            try {
                val resp = client.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, TimeRangeFilter.between(start, end)))
                val out = JSArray()
                resp.records.filter { it.metadata.dataOrigin.packageName != context.packageName }.forEach {
                    out.put(JSObject()
                        .put("id", it.metadata.id)
                        .put("start", it.startTime.toEpochMilli()).put("end", it.endTime.toEpochMilli())
                        .put("type", it.exerciseType).put("title", it.title ?: "")
                        .put("origin", it.metadata.dataOrigin.packageName))
                }
                call.resolve(JSObject().put("records", out))
            } catch (e: Exception) { call.reject(e.message ?: "readExercises") }
        }
    }
}
