// STRATOS — infobulles de definition, tirees des glossaires du cours.
//
// Dans le coffre, un terme se marque par un lien ordinaire vers son glossaire,
// l'ancre portant le terme tel qu'il est ecrit en gras dans le tableau :
//
//     [[Glossaire de la partie 1#Donnée|données]]
//
// Ce script repere ces liens (vers une page « Glossaire de la partie N », AVEC
// une ancre), va lire la definition dans le glossaire publie, et l'affiche en
// infobulle : au survol a la souris, au focus clavier, au premier toucher sur
// ecran tactile (le second toucher ouvre le glossaire).
//
// Le glossaire reste la SEULE source des definitions : corriger une ligne du
// tableau corrige toutes les infobulles. verifier-glossaire.mjs bloque la
// publication si une ancre ne correspond a aucun terme.
//
// Enrichissement progressif : sans ce script, ou si le glossaire ne se charge
// pas, le lien reste un lien vers le glossaire et la page reste complete.
//
// Installe par installer-glossaire.mjs dans quartz/static/glossaire/.

const GLOSSAIRE = /\/glossaire-de-la-partie-\d+(\.html)?\/?$/i

// Cle de comparaison : l'ancre produite par Quartz (« piste-daudit ») et le
// terme du tableau (« Piste d’audit ») doivent se rejoindre, quelle que soit la
// facon dont le slug a traite accents, apostrophes et espaces.
// Meme fonction dans verifier-glossaire.mjs : les garder identiques.
const cle = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const estTermeGlossaire = (a) => {
  if (!(a instanceof HTMLAnchorElement) || !a.hash) return false
  try {
    const url = new URL(a.href)
    return url.origin === location.origin && GLOSSAIRE.test(decodeURIComponent(url.pathname))
  } catch {
    return false
  }
}

/* --- lecture des glossaires ----------------------------------------- */

const glossaires = new Map() // chemin -> Promise<Map<cle, {terme, definition}>>

function lireGlossaire(chemin) {
  if (!glossaires.has(chemin)) {
    const p = fetch(chemin)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status} ${chemin}`))))
      .then((html) =>
        indexer(new DOMParser().parseFromString(html, "text/html"), new URL(chemin, location.href)),
      )
      .catch((e) => {
        glossaires.delete(chemin) // on retentera au prochain survol
        throw e
      })
    glossaires.set(chemin, p)
  }
  return glossaires.get(chemin)
}

// Chaque ligne de tableau dont la premiere cellule s'ouvre sur un terme en gras.
// « SI — système d’information » donne la cle « si » ; « PGI / ERP » donne
// « pgierp », « pgi » et « erp ».
// Meme regle dans verifier-glossaire.mjs : les garder identiques.
function clesDeLaLigne(tr) {
  const cellules = tr.querySelectorAll("td")
  if (cellules.length < 2) return []
  const gras = cellules[0].querySelector("strong")
  if (!gras) return []
  const tete = gras.textContent.trim()
  return [tete, ...tete.split("/")].map(cle).filter(Boolean)
}

// base : l'URL du glossaire. Les liens d'une definition sont relatifs a SA page ;
// recopies tels quels dans l'infobulle d'un chapitre, ils viseraient ailleurs.
function indexer(doc, base) {
  const index = new Map()
  for (const tr of doc.querySelectorAll("article tr")) {
    const cles = clesDeLaLigne(tr)
    if (!cles.length) continue
    const [terme, definition] = tr.querySelectorAll("td")
    for (const el of definition.querySelectorAll("[href]")) {
      el.setAttribute("href", new URL(el.getAttribute("href"), base).href)
    }
    const entree = {
      terme: terme.textContent.trim(),
      definition: definition.innerHTML.trim(),
    }
    for (const c of cles) if (!index.has(c)) index.set(c, entree)
  }
  return index
}

async function definitionDe(a) {
  const url = new URL(a.href)
  const index = await lireGlossaire(url.pathname)
  return index.get(cle(decodeURIComponent(url.hash.slice(1))))
}

/* --- l'infobulle ---------------------------------------------------- */

let bulle = null
let ancre = null // le lien dont l'infobulle est affichee
let minuterie = 0

// Recreee si le routeur SPA de Quartz l'a retiree du <body> en changeant de page.
function laBulle() {
  if (bulle && document.body.contains(bulle)) return bulle
  bulle = document.createElement("div")
  bulle.id = "stratos-glossaire-bulle"
  bulle.className = "glossaire-bulle"
  bulle.setAttribute("role", "tooltip")
  bulle.hidden = true
  // La souris peut passer du mot a l'infobulle (pour cliquer « Voir le glossaire »).
  bulle.addEventListener("pointerenter", () => clearTimeout(minuterie))
  bulle.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") masquerBientot()
  })
  document.body.appendChild(bulle)
  return bulle
}

async function afficher(a) {
  clearTimeout(minuterie)
  if (ancre === a && bulle && !bulle.hidden) return
  ancre = a
  let entree
  try {
    entree = await definitionDe(a)
  } catch (e) {
    console.warn("[glossaire]", e)
    return
  }
  if (ancre !== a) return // la souris est deja partie ailleurs
  if (!entree) {
    console.warn(`[glossaire] terme absent du glossaire : ${decodeURIComponent(new URL(a.href).hash)}`)
    return
  }

  const b = laBulle()
  b.replaceChildren()
  const terme = document.createElement("strong")
  terme.className = "glossaire-terme"
  terme.textContent = entree.terme
  const def = document.createElement("span")
  def.className = "glossaire-definition"
  def.innerHTML = entree.definition // HTML du glossaire publie, meme origine
  const lien = document.createElement("a")
  lien.className = "glossaire-lien"
  lien.href = a.href
  lien.textContent = "Voir le glossaire \u203a"
  b.append(terme, def, lien)

  b.hidden = false
  a.setAttribute("aria-describedby", b.id)
  placer(a, b)
}

function placer(a, b) {
  // Premier fragment du mot : un lien coupe en fin de ligne a deux rectangles.
  const r = a.getClientRects()[0] || a.getBoundingClientRect()
  const marge = 8
  b.style.left = "0px"
  b.style.top = "0px"
  const { width, height } = b.getBoundingClientRect()
  let x = r.left + r.width / 2 - width / 2
  x = Math.max(marge, Math.min(x, document.documentElement.clientWidth - width - marge))
  // Au-dessus du mot s'il y a la place, sinon en dessous.
  const dessus = r.top - height - marge >= 0
  const y = dessus ? r.top - height - marge : r.bottom + marge
  b.dataset.cote = dessus ? "dessus" : "dessous"
  b.style.left = `${Math.round(x + window.scrollX)}px`
  b.style.top = `${Math.round(y + window.scrollY)}px`
}

function masquer() {
  clearTimeout(minuterie)
  if (ancre) ancre.removeAttribute("aria-describedby")
  ancre = null
  if (bulle) bulle.hidden = true
}

function masquerBientot() {
  clearTimeout(minuterie)
  minuterie = setTimeout(masquer, 180)
}

/* --- les evenements ------------------------------------------------- */

// Ecran tactile : le premier toucher montre la definition, le second suit le
// lien. Le focus arrive AVANT le clic et ouvrirait deja l'infobulle : on note
// donc, a l'appui, si elle etait ouverte pour ce mot avant qu'on le touche.
let appuiTactile = false
let dejaOuverte = false

function surAppui(e) {
  appuiTactile = e.pointerType !== "mouse"
  dejaOuverte = ancre === this && !!bulle && !bulle.hidden
}

function surClic(e) {
  const tactile = appuiTactile
  appuiTactile = false // un clic clavier (Entree) n'a pas d'appui : il suit le lien
  if (!tactile || dejaOuverte) return
  e.preventDefault()
  e.stopPropagation() // le routeur SPA de Quartz ecoute sur window
  afficher(this)
}

function surEntree(e) {
  if (e.pointerType === "mouse") afficher(this)
}

function surSortie(e) {
  if (e.pointerType === "mouse") masquerBientot()
}

function surFocus() {
  afficher(this)
}

function surPerteFocus() {
  masquerBientot()
}

function equiperLien(a) {
  a.classList.add("terme-glossaire")
  // L'apercu de page de Quartz montrerait tout le glossaire par-dessus la bulle.
  a.dataset.noPopover = "true"
  a.addEventListener("pointerdown", surAppui)
  a.addEventListener("click", surClic)
  a.addEventListener("pointerenter", surEntree)
  a.addEventListener("pointerleave", surSortie)
  a.addEventListener("focus", surFocus)
  a.addEventListener("blur", surPerteFocus)
}

// Sur la page du glossaire, arrivee par « Voir le glossaire » ou par le lien
// lui-meme : les lignes n'ont pas d'identifiant, Quartz ne sait donc pas ou
// descendre. On le fait ici, et la ligne s'allume un instant.
function allumerLaLigneVisee() {
  if (!location.hash || !GLOSSAIRE.test(decodeURIComponent(location.pathname))) return
  const visee = cle(decodeURIComponent(location.hash.slice(1)))
  for (const tr of document.querySelectorAll("article tr")) {
    if (!clesDeLaLigne(tr).includes(visee)) continue
    tr.scrollIntoView({ block: "center" })
    tr.classList.remove("glossaire-vise")
    void tr.offsetWidth // relance l'animation si la ligne etait deja allumee
    tr.classList.add("glossaire-vise")
    return
  }
}

function equiperLaPage() {
  masquer()
  for (const a of document.querySelectorAll("article a.internal")) {
    if (!a.classList.contains("terme-glossaire") && estTermeGlossaire(a)) equiperLien(a)
  }
  allumerLaLigneVisee()
}

// Ecouteurs de document : poses UNE fois, le script survit aux navigations SPA.
if (!window.__stratosGlossaire) {
  window.__stratosGlossaire = true
  document.addEventListener("nav", equiperLaPage)
  document.addEventListener("render", equiperLaPage)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") masquer()
  })
  // Un toucher ailleurs que sur un mot ou sur la bulle la referme.
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || !bulle || bulle.hidden) return
    if (!e.target.closest?.(".terme-glossaire, .glossaire-bulle")) masquer()
  })
  window.addEventListener("resize", masquer)
  if (document.readyState !== "loading") equiperLaPage()
  else document.addEventListener("DOMContentLoaded", equiperLaPage)
}
