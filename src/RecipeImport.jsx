// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ---------------------------------------------------------------- */
/* IMPORTER UNE RECETTE (Instagram, TikTok, blog, texte, vidéo)      */
/*  - texte collé (description d'un post) ;                          */
/*  - lien : la page est lue (recette structurée d'un blog,          */
/*    description d'un post Instagram) ;                             */
/*  - vidéo : Gemini lit les sous-titres incrustés et écoute la voix */
/*    (quand la description ne contient pas la recette).             */
/* L'IA convertit en grammes, puis chaque ingrédient est relié à la  */
/* table Ciqual quand c'est sûr ; le reste garde l'estimation IA.    */
/* ---------------------------------------------------------------- */
import React, { useState, useRef } from "react";
import { FileText, Link as LinkIcon, Loader2, Video } from "lucide-react";
import { C, MONO, inputStyle, round, uid } from "./shared.jsx";
import { Sheet } from "./MealTools.jsx";
import { geminiGenerate, parseJSONLoose, getAiProvider } from "./gemini.js";
import { httpRequest } from "./net.js";
import { loadCiqual, searchCiqual } from "./ciqualDb.js";
import { RECIPE_CATS, recipeCat } from "./foodData.js";

export const VIDEO_MAX_MB = 19; // limite d'un envoi direct à Gemini (20 Mo par requête)
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

/* ---------------- lecture d'une page web ---------------- */
function decodeEntities(s) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
const stripTags = (h) => decodeEntities(String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();
function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decodeEntities(tag.match(/content=["']([\s\S]*?)["']/i)?.[1] || "") : "";
}
/** Recette structurée (schema.org/Recipe) présente sur la plupart des blogs et sites de cuisine. */
export function recipeFromJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const find = (o) => {
    if (!o || typeof o !== "object") return null;
    if (Array.isArray(o)) { for (const x of o) { const r = find(x); if (r) return r; } return null; }
    const t = o["@type"]; if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return o;
    return find(o["@graph"]) || null;
  };
  for (const b of blocks) {
    let r = null; try { r = find(JSON.parse(b.trim())); } catch (e) {}
    if (!r) continue;
    const steps = [];
    const walk = (s) => { if (!s) return; if (typeof s === "string") steps.push(stripTags(s)); else if (Array.isArray(s)) s.forEach(walk); else if (s.itemListElement) walk(s.itemListElement); else if (s.text) steps.push(stripTags(s.text)); };
    walk(r.recipeInstructions);
    const author = Array.isArray(r.author) ? r.author[0]?.name : r.author?.name || r.author;
    const lines = [
      r.name ? "Recette : " + stripTags(r.name) : "",
      r.recipeYield ? "Portions : " + [].concat(r.recipeYield).join(" / ") : "",
      "Ingrédients :", ...[].concat(r.recipeIngredient || r.ingredients || []).map((x) => "- " + stripTags(x)),
      steps.length ? "Préparation :" : "", ...steps.map((s, i) => `${i + 1}. ${s}`),
    ].filter(Boolean);
    return { text: lines.join("\n"), author: typeof author === "string" ? author : "", title: stripTags(r.name || "") };
  }
  return null;
}
/** Description d'un post Instagram (balise og:description : « 1 234 likes, 56 comments - auteur on … : "texte" »). */
export function captionFromInstagramMeta(desc) {
  const m = desc.match(/^[\s\S]*?-\s*([\w.]+)\s+on\s+[^:]*:\s*["“]?([\s\S]*?)["”]?\.?\s*$/);
  if (m) return { author: m[1], text: m[2].trim() };
  return { author: "", text: desc.trim() };
}
const isInsta = (u) => /instagram\.com\//i.test(u);
const instaCode = (u) => u.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i)?.[1];

export async function fetchRecipeFromUrl(url, signal) {
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) throw new Error("colle un lien complet qui commence par https://");
  const headers = { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8", Accept: "text/html,application/xhtml+xml" };
  let best = { text: "", author: "", title: "", url: u };
  try {
    const r = await httpRequest(u, { headers, text: true, timeoutMs: 20000, signal });
    const html = typeof r.data === "string" ? r.data : "";
    const ld = html && recipeFromJsonLd(html);
    if (ld && ld.text.length > 40) return { ...ld, url: u, from: "recette structurée de la page" };
    const desc = meta(html, "og:description") || meta(html, "description");
    if (desc) {
      const c = isInsta(u) ? captionFromInstagramMeta(desc) : { author: "", text: desc };
      best = { text: c.text, author: c.author, title: meta(html, "og:title"), url: u, from: "description de la page" };
    }
  } catch (e) { if (e.cancelled) throw e; }
  // Instagram coupe parfois la description : la page « embed » publique donne la légende entière
  if (isInsta(u) && instaCode(u) && best.text.length < 200) {
    try {
      const r = await httpRequest(`https://www.instagram.com/p/${instaCode(u)}/embed/captioned/`, { headers, text: true, timeoutMs: 20000, signal });
      const html = typeof r.data === "string" ? r.data : "";
      const cap = html.match(/class=["']Caption["'][^>]*>([\s\S]*?)<div class=["']CaptionComments/i)?.[1]
        || html.match(/class=["']Caption["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
      if (cap) {
        let text = stripTags(cap);
        const author = html.match(/class=["']CaptionUsername["'][^>]*>([^<]+)</i)?.[1]?.trim() || best.author;
        if (author && text.startsWith(author)) text = text.slice(author.length).trim();
        if (text.length > best.text.length) best = { ...best, text, author, from: "légende du post" };
      }
    } catch (e) { if (e.cancelled) throw e; }
  }
  if (best.text.trim().length < 20) {
    throw new Error("je n'ai pas pu lire la recette sur cette page (compte privé, connexion demandée ou page protégée). Copie la description du post et colle-la dans « Texte », ou importe la vidéo.");
  }
  return best;
}

/* ---------------- conversion par l'IA ---------------- */
const PROMPT = (src) => `Tu es diététicien. ${src}
Extrais la recette et convertis-la pour une appli de nutrition française :
- traduis en français ;
- chaque ingrédient en GRAMMES (cup, tbsp, tsp, oz, pièces, sachets, ml… → grammes réalistes : 1 œuf ≈ 50 g, 1 c. à soupe d'huile ≈ 13 g, 1 c. à café ≈ 5 g, 1 cup de farine ≈ 120 g, 1 sachet de levure ≈ 11 g, 1 cube de bouillon ≈ 10 g, liquides : 1 ml ≈ 1 g) ;
- "name" : nom générique de l'aliment tel qu'on le chercherait dans une table nutritionnelle (« Farine de blé », « Compote de pommes », « Lait de coco allégé »), "orig" : la quantité telle qu'écrite dans la source ;
- valeurs POUR 100 g de l'ingrédient tel qu'utilisé (cru en général) : kcal100, prot100, carbs100, fat100 ;
- "servings" : nombre de portions annoncé, sinon estime-le ;
- "steps" : étapes de préparation courtes, en français (vide si la source n'en donne pas) ;
- "categorie" : une de ${RECIPE_CATS.join(", ")}.
Ignore les hashtags, mentions et appels à commenter. Si aucune recette n'est trouvable, renvoie "ingredients": [].
Réponds UNIQUEMENT en JSON :
{"name":"","author":"","servings":4,"categorie":"Plat","ingredients":[{"name":"","orig":"","grams":0,"kcal100":0,"prot100":0,"carbs100":0,"fat100":0}],"steps":[""]}`;

async function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}

export async function aiParseRecipe({ aiKey, geminiKey, text, video, onStatus, signal }) {
  let parts, opts = { onStatus, signal, temperature: 0.2, timeoutMs: 60000, totalMs: 120000 };
  if (video) {
    if (!geminiKey) throw new Error("la lecture de vidéo demande une clé Gemini (gratuite) : ajoute-la dans Moi → Intelligence artificielle");
    if (video.size > VIDEO_MAX_MB * 1048576) throw new Error(`vidéo trop lourde (${Math.round(video.size / 1048576)} Mo, maximum ${VIDEO_MAX_MB} Mo) : coupe-la ou exporte-la en plus basse qualité`);
    onStatus && onStatus("Envoi de la vidéo…");
    const data = await fileToBase64(video);
    parts = [
      { text: PROMPT("Voici une vidéo de recette (reel Instagram, TikTok…). Lis TOUS les textes et sous-titres incrustés à l'image, écoute ce qui est dit, et regarde les ingrédients montrés.") },
      { inline_data: { mime_type: video.type || "video/mp4", data } },
    ];
    opts = { ...opts, provider: "gemini", timeoutMs: 150000, totalMs: 240000 };
    return finish(await geminiGenerate(geminiKey, parts, opts));
  }
  if (!aiKey) throw new Error("ajoute une clé d'IA dans Moi → Intelligence artificielle");
  parts = [{ text: PROMPT(`Voici le texte d'une recette (description d'un post Instagram, page web ou recette recopiée) :\n«««\n${text.trim().slice(0, 12000)}\n»»»`) }];
  return finish(await geminiGenerate(aiKey, parts, opts));
}
function finish(out) {
  const r = parseJSONLoose(out) || {};
  const n = (v) => Math.max(0, Number(v) || 0);
  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : []).filter((x) => x && x.name).map((x) => ({
    name: String(x.name).slice(0, 80), orig: String(x.orig || "").slice(0, 80), grams: Math.round(n(x.grams)) || 1,
    kcal100: n(x.kcal100), prot100: n(x.prot100), carbs100: n(x.carbs100), fat100: n(x.fat100),
  }));
  if (!ingredients.length) throw new Error("aucune recette trouvée dans ce contenu (la description ne contient peut-être que des hashtags : essaie la vidéo)");
  const steps = (Array.isArray(r.steps) ? r.steps : []).map((s) => String(s).trim()).filter(Boolean);
  const name = String(r.name || "").trim().slice(0, 80) || "Recette importée";
  return {
    name, author: String(r.author || "").replace(/^@/, "").trim(), servings: Math.max(1, Math.round(Number(r.servings) || 2)),
    categorie: RECIPE_CATS.includes(r.categorie) ? r.categorie : recipeCat({ name }), ingredients, steps,
  };
}

// mots qui ne changent pas l'aliment (présentation, précision) / mots qui en font une variante
const NEUTRAL = new Set(["cru", "crue", "nature", "frai", "fraiche", "entier", "entiere", "standard", "moyen", "aliment", "preemballe", "preemballee", "vrac",
  "de", "du", "des", "la", "le", "les", "au", "a", "en", "et", "ou", "l", "d", "type", "sans", "precision", "teneur", "rayon", "ambiant", "tablette",
  "environ", "cacao", "brut", "commerce", "tendre", "froment", "poudre", "lever", "ni", "sur"]);
const VARIANT = new Set(["fourre", "praline", "aux", "avec", "aromatise", "allege", "allegee", "light", "edulcorant", "edulcorant", "fourrage", "menthe", "fruit", "sucree", "sale"]);
const words = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/)
  .filter(Boolean).map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

/** Relie chaque ingrédient à la table Ciqual quand le nom et les calories concordent ; sinon garde l'estimation IA. */
export async function linkToCiqual(ingredients) {
  try { await loadCiqual(); } catch (e) { return ingredients.map((i) => ({ ...i, key: uid(), foodId: null, brand: true, ai: true })); }
  return ingredients.map((i) => {
    const near = (f) => Math.abs(f.kcal - i.kcal100) <= Math.max(30, 0.3 * Math.max(f.kcal, i.kcal100));
    // parmi les aliments proches en calories, le plus « générique » : le moins de mots en plus de ceux demandés
    // (« Chocolat noir » ≠ « Chocolat noir fourré praliné » ; « Oeuf, cru » avant « Oeuf dur »)
    const want = new Set(words(i.name));
    const extra = (f) => words(f.name).filter((w) => !want.has(w) && !NEUTRAL.has(w) && !/^\d+$/.test(w))
      .reduce((a, w) => a + (VARIANT.has(w) ? 25 : 10), 0);
    const hits = searchCiqual(i.name, 15).filter(near);
    const hit = hits.map((f, k) => [extra(f) + Math.abs(f.kcal - i.kcal100) / 10 + k * 0.5, f]).sort((a, b) => a[0] - b[0])[0]?.[1];
    if (hit) return { ...i, key: uid(), foodId: hit.id, name: hit.name, kcal100: hit.kcal, prot100: hit.prot, carbs100: hit.carbs, fat100: hit.fat, brand: false, ciqual: true, aiName: i.name };
    return { ...i, key: uid(), foodId: null, brand: true, ai: true };
  });
}

/* ---------------- fenêtre d'import ---------------- */
export function ImportRecipeSheet({ aiKey, geminiKey, onDone, onClose }) {
  const [mode, setMode] = useState("texte");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState(null);
  const [fetched, setFetched] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const abortRef = useRef(null);
  const provider = getAiProvider() === "grok" ? "Grok" : "Gemini";

  async function run(fn) {
    setErr(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try { await fn(ctrl.signal); } catch (e) { if (!e.cancelled) setErr(e.message || "erreur"); } finally { setBusy(null); }
  }
  const convert = (payload, source) => run(async (signal) => {
    setBusy("Conversion de la recette en grammes…");
    const r = await aiParseRecipe({ aiKey, geminiKey, ...payload, onStatus: setBusy, signal });
    setBusy("Liaison des ingrédients à la table Ciqual…");
    const ingredients = await linkToCiqual(r.ingredients);
    onDone({ ...r, ingredients, author: r.author || source?.author || "", url: source?.url || "", origine: source?.origine || "Import" });
  });
  const readLink = () => run(async (signal) => {
    setBusy("Lecture de la page…");
    const f = await fetchRecipeFromUrl(url, signal);
    setFetched(f);
  });

  const tab = (k, Icon, l) => (
    <button key={k} onClick={() => { setMode(k); setErr(null); }} style={{
      flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
      background: mode === k ? C.card : "transparent", color: mode === k ? C.herb : C.inkSoft,
    }}><Icon size={13} /> {l}</button>
  );
  const primary = (label, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled || !!busy} style={{
      width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 12, border: "none", background: disabled ? C.line : C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14,
    }}>{label}</button>
  );
  const small = { fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 8px" };

  return (
    <Sheet title="Importer une recette" onClose={onClose}>
      <div style={{ display: "flex", gap: 4, marginBottom: 12, background: C.paperDark, borderRadius: 10, padding: 3 }}>
        {tab("texte", FileText, "Texte")}{tab("lien", LinkIcon, "Lien")}{tab("video", Video, "Vidéo")}
      </div>

      {mode === "texte" && (
        <>
          <p style={small}>Sur le post, copie la description (légende), puis colle-la ici. {provider} convertit toute la recette en grammes et la relie aux aliments.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Colle la description ici…" rows={8}
            style={{ ...inputStyle, width: "100%", resize: "vertical", fontSize: 13, lineHeight: 1.45 }} />
          {primary("Convertir la recette", () => convert({ text }, { origine: "Texte collé" }), text.trim().length < 15 || !aiKey)}
        </>
      )}

      {mode === "lien" && (
        <>
          <p style={small}>Lien d'un post Instagram public, d'un TikTok ou d'une page de recette (blog, Marmiton…). La recette est lue directement sur la page.</p>
          <input value={url} onChange={(e) => { setUrl(e.target.value); setFetched(null); }} placeholder="https://www.instagram.com/reel/…" inputMode="url"
            style={{ ...inputStyle, width: "100%", fontFamily: MONO, fontSize: 12.5 }} />
          {!fetched && primary("Lire la page", readLink, !/^https?:\/\/\S+\.\S+/.test(url.trim()))}
          {fetched && (
            <>
              <p style={{ ...small, margin: "10px 0 4px", color: C.herb }}>✓ Trouvé : {fetched.from}{fetched.author ? ` · @${fetched.author}` : ""}. Vérifie ou complète le texte :</p>
              <textarea value={fetched.text} onChange={(e) => setFetched({ ...fetched, text: e.target.value })} rows={7}
                style={{ ...inputStyle, width: "100%", resize: "vertical", fontSize: 12.5, lineHeight: 1.45 }} />
              {primary("Convertir la recette", () => convert({ text: [fetched.title, fetched.text].filter(Boolean).join("\n") }, { url: fetched.url, author: fetched.author, origine: isInsta(fetched.url) ? "Instagram" : "En ligne" }), !aiKey)}
            </>
          )}
        </>
      )}

      {mode === "video" && (
        <>
          <p style={small}>
            Quand la description ne donne pas la recette : enregistre la vidéo sur ton téléphone, puis choisis-la ici.
            Gemini lit les <strong>sous-titres incrustés</strong>, écoute la <strong>voix</strong> et repère les ingrédients montrés.
            Une vidéo d'une minute tient largement dans le quota gratuit (maximum {VIDEO_MAX_MB} Mo).
          </p>
          {!geminiKey && <p style={{ ...small, color: C.berry }}>Il faut une clé Gemini (gratuite) pour lire les vidéos : Moi → Intelligence artificielle → Gemini.</p>}
          <label style={{
            width: "100%", padding: "20px 0", borderRadius: 14, border: `1.5px dashed ${C.herb}`, background: C.sage, color: C.herb,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: geminiKey ? 1 : 0.5,
          }}>
            <Video size={22} /> {video ? video.name : "Choisir la vidéo"}
            {video && <span style={{ fontSize: 11.5, fontWeight: 400, color: video.size > VIDEO_MAX_MB * 1048576 ? C.berry : C.inkSoft }}>{(video.size / 1048576).toFixed(1).replace(".", ",")} Mo</span>}
            <input type="file" accept="video/*" style={{ display: "none" }} disabled={!geminiKey} onChange={(e) => { setVideo(e.target.files[0] || null); e.target.value = ""; setErr(null); }} />
          </label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Lien du post (facultatif, pour le retrouver)" inputMode="url"
            style={{ ...inputStyle, width: "100%", marginTop: 8, fontFamily: MONO, fontSize: 12 }} />
          {primary("Analyser la vidéo", () => convert({ video }, { url: url.trim(), origine: isInsta(url) ? "Instagram" : "Vidéo" }), !video || !geminiKey)}
        </>
      )}

      {busy && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Loader2 size={15} color={C.herb} style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 12.5, color: C.inkSoft, flex: 1 }}>{busy}</span>
          <button onClick={() => abortRef.current?.abort()} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: C.inkSoft }}>Annuler</button>
          <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
        </div>
      )}
      {err && <p style={{ color: C.berry, fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.45 }}>{err}</p>}
      {!aiKey && mode !== "video" && <p style={{ ...small, color: C.berry, marginTop: 10 }}>Ajoute une clé d'IA dans Moi → Intelligence artificielle pour convertir les recettes.</p>}
    </Sheet>
  );
}
