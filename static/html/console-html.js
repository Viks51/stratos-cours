/* =====================================================================
 *  Console HTML du cours — Stratos Solutions
 *
 *  Rend « affichables », dans la page, les blocs ```html du cours : le
 *  bloc reste l'affichage TEXTE (le code source, tel que le recoit le
 *  navigateur), la console ajoute dessous l'affichage HTML (la page,
 *  telle que le navigateur la dessine), dans une fausse fenetre de
 *  navigateur dont l'onglet porte le <title>.
 *
 *  Aucun moteur a embarquer : le moteur, c'est le navigateur lui-meme.
 *  Le rendu se fait dans une <iframe sandbox> SANS allow-scripts : ce
 *  que tape l'etudiant ne peut executer aucun JavaScript, ni soumettre
 *  de formulaire, ni naviguer la page du cours. allow-same-origin sert
 *  seulement a mesurer la hauteur du rendu — sans scripts, il n'ouvre
 *  rien au contenu de l'iframe.
 *
 *  PRINCIPE DIRECTEUR : enrichissement progressif, comme la console
 *  SQL. Si ce script echoue, la page reste celle qu'elle serait sans
 *  lui : le code reste lisible. Tout est enveloppe dans des try/catch.
 * ===================================================================== */

const HAUTEUR_MIN = 90
const HAUTEUR_MAX = 520
const DELAI_RENDU = 250 // ms : le rendu suit la frappe sans clignoter

/* ------------------------------------------------------------------ */
/*  Lecture des directives                                             */
/* ------------------------------------------------------------------ */

/**
 * Les directives sont des commentaires HTML en tete de bloc, une par
 * ligne. Comme celles de la console SQL, elles restent visibles pour le
 * lecteur, ne s'affichent pas dans le rendu, et survivent a n'importe
 * quel moteur de rendu.
 *
 *   <!-- non exécutable -->        le bloc reste un simple bloc de code
 *   <!-- bac à sable -->           editeur ouvert, rendu immediat
 *   <!-- adresse : www.x.fr -->    l'adresse affichee dans la fenetre
 *                                  (par defaut « page.html » : un fichier
 *                                  ouvert sur le poste de l'etudiant)
 *   <!-- objectif : texte | sel -->  une case qui se coche quand le
 *                                  selecteur CSS « sel » trouve un
 *                                  element dans le code de l'etudiant ;
 *   <!-- objectif : texte | sel ~ a & b -->  exige en plus des elements
 *                                  DISTINCTS contenant « a », « b »… :
 *                                  « ol > li ~ métré & devis & pose »
 *                                  veut trois <li>, une etape chacun.
 *                                  La comparaison ignore la casse, les
 *                                  accents et les espaces multiples : on
 *                                  juge le HTML, pas la frappe.
 *
 *  Un bloc a objectifs exige aussi un code BIEN FORME (toute balise
 *  ouverte est refermee, dans l'ordre) avant de dire « Bravo » : le
 *  navigateur repare en silence, le cours enseigne a ne pas compter
 *  dessus.
 */
function lireDirectives(code) {
  const d = {
    executable: true,
    bacASable: false,
    adresse: "page.html",
    objectifs: [],
    corps: code, // le code sans ses directives : ce que montre l'editeur
  }

  const lignes = code.split("\n")
  let n = 0
  for (const l of lignes) {
    const m = l.trim().match(/^<!--\s*(.*?)\s*-->$/)
    if (!m) break
    const brut = m[1]
    const c = brut.toLowerCase()
    if (c.startsWith("non exécutable") || c.startsWith("non executable")) d.executable = false
    else if (c.startsWith("bac à sable") || c.startsWith("bac a sable")) d.bacASable = true
    else if (c.startsWith("adresse")) d.adresse = brut.replace(/^adresse\s*:?\s*/i, "")
    else if (!c.startsWith("objectif")) break // un commentaire ordinaire : il fait partie du code
    n++
    if (c.startsWith("objectif")) {
      const corps = brut.replace(/^objectif\s*:?\s*/i, "")
      const i = corps.lastIndexOf("|")
      if (i > 0) {
        const [selecteur, ...mot] = corps.slice(i + 1).split("~")
        d.objectifs.push({
          texte: corps.slice(0, i).trim(),
          selecteur: selecteur.trim(),
          termes: mot
            .join("~")
            .split("&")
            .map(normaliser)
            .filter(Boolean),
        })
      }
    }
  }
  // Les directives restent dans le bloc imprime, ou elles tiennent lieu
  // d'enonce ; pas dans l'editeur, ou les objectifs feraient doublon avec
  // les cases a cocher.
  d.corps = lignes.slice(n).join("\n")
  return d
}

/* ------------------------------------------------------------------ */
/*  Les objectifs                                                      */
/* ------------------------------------------------------------------ */

/** « Le  Métré » et « le metre » se valent : seul compte le HTML. */
function normaliser(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

/**
 * Un objectif est atteint quand le selecteur trouve un element et, s'il
 * exige des termes, quand chacun se trouve dans un element DIFFERENT :
 * trois <li> vides, ou les trois etapes entassees dans un seul <li>, ne
 * font pas une liste de trois etapes.
 */
function atteint(doc, objectif) {
  const elements = [...doc.querySelectorAll(objectif.selecteur)]
  if (!objectif.termes.length) return elements.length > 0
  const textes = elements.map((el) => normaliser(el.textContent))
  const pris = new Set()
  return objectif.termes.every((t) => {
    const k = textes.findIndex((x, j) => !pris.has(j) && x.includes(t))
    if (k < 0) return false
    pris.add(k)
    return true
  })
}

// Balises sans fermeture : la seule exception a la regle du cours.
const VIDES = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
  "source", "track", "wbr",
])

/**
 * Toute balise ouverte est-elle refermee, et dans l'ordre ? Rend null si
 * oui, sinon une phrase qui situe la PREMIERE faute (le reste en decoule
 * souvent). Le controle porte sur le texte tape, pas sur le DOM : le
 * DOMParser, comme le navigateur, aurait deja tout repare.
 */
function malForme(code) {
  // Les commentaires ne comptent pas ; leurs retours a la ligne, si.
  const texte = code.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
  const ligne = (i) => texte.slice(0, i).split("\n").length
  const pile = []
  const balise = /<(\/?)([a-zA-Z][\w-]*)\b[^>]*?(\/?)>/g
  let m
  while ((m = balise.exec(texte))) {
    const nom = m[2].toLowerCase()
    if (VIDES.has(nom)) continue
    const l = ligne(m.index)
    if (!m[1]) {
      if (!m[3]) pile.push({ nom, l })
      continue
    }
    if (pile.length && pile[pile.length - 1].nom === nom) {
      pile.pop()
      continue
    }
    if (!pile.some((p) => p.nom === nom)) {
      return `la balise </${nom}> (ligne ${l}) ferme une balise qui n’a pas été ouverte.`
    }
    const p = pile[pile.length - 1]
    return `la balise <${p.nom}> (ligne ${p.l}) n’est pas refermée avant </${nom}> (ligne ${l}).`
  }
  if (pile.length) {
    const p = pile[pile.length - 1]
    return `la balise <${p.nom}> (ligne ${p.l}) n’est jamais refermée.`
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Rendu                                                              */
/* ------------------------------------------------------------------ */

/**
 * Les liens s'ouvrent dans un nouvel onglet : dans l'iframe, ils
 * chargeraient le site vise a la place du rendu, et la plupart des sites
 * refusent d'etre affiches dans un cadre. La balise <base> est glissee
 * dans le <head> s'il existe, sans quoi un <!DOCTYPE> place apres elle
 * ferait basculer le rendu en mode de compatibilite.
 */
function preparer(html) {
  const base = '<base target="_blank">'
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (h) => h + base)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (h) => h + base)
  if (/<!doctype[^>]*>/i.test(html)) return html.replace(/<!doctype[^>]*>/i, (h) => h + base)
  return base + html
}

/** Analyse inerte : DOMParser n'execute rien et ne charge rien. */
function analyser(html) {
  try {
    return new DOMParser().parseFromString(html, "text/html")
  } catch {
    return null
  }
}

function ajusterHauteur(iframe) {
  try {
    const doc = iframe.contentDocument
    if (!doc || !doc.documentElement) return
    const h = Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0)
    iframe.style.height = Math.min(Math.max(h + 4, HAUTEUR_MIN), HAUTEUR_MAX) + "px"
  } catch {
    /* hauteur par defaut : le rendu defile, rien de grave */
  }
}

/* ------------------------------------------------------------------ */
/*  Construction de la console sous un bloc                            */
/* ------------------------------------------------------------------ */

function bouton(texte, classe) {
  const b = document.createElement("button")
  b.type = "button"
  b.className = "console-html-bouton" + (classe ? " " + classe : "")
  b.textContent = texte
  return b
}

function equiper(pre) {
  const code = pre.querySelector("code")
  if (!code) return

  const original = code.textContent.replace(/\n$/, "")
  const directives = lireDirectives(original)
  if (!directives.executable) return

  // Le bloc peut etre enveloppe dans un <figure> par le coloriseur.
  const ancre = pre.closest("figure[data-rehype-pretty-code-figure]") ?? pre

  const console_ = document.createElement("div")
  console_.className = "console-html"

  /* --- la barre --- */
  const barre = document.createElement("div")
  barre.className = "console-html-barre"

  const bAfficher = bouton("Afficher la page", "console-html-afficher")
  const bModifier = bouton("Modifier")
  const bOrigine = bouton("Code d’origine", "console-html-discret")
  bOrigine.hidden = true

  const etiquette = document.createElement("span")
  etiquette.className = "console-html-etiquette"
  etiquette.textContent = "le code → la page"

  barre.append(bAfficher, bModifier, bOrigine, etiquette)

  /* --- l'espace de travail : editeur (texte) + fenetre (HTML) --- */
  const espace = document.createElement("div")
  espace.className = "console-html-espace"

  const editeur = document.createElement("textarea")
  editeur.className = "console-html-editeur"
  editeur.spellcheck = false
  editeur.value = directives.corps
  editeur.hidden = true
  editeur.setAttribute("aria-label", "Code HTML modifiable")

  const fenetre = document.createElement("div")
  fenetre.className = "console-html-fenetre"
  fenetre.hidden = true

  const chrome = document.createElement("div")
  chrome.className = "console-html-chrome"
  const pastilles = document.createElement("span")
  pastilles.className = "console-html-pastilles"
  pastilles.setAttribute("aria-hidden", "true")
  for (let i = 0; i < 3; i++) pastilles.appendChild(document.createElement("i"))
  const onglet = document.createElement("span")
  onglet.className = "console-html-onglet"
  onglet.title = "Le contenu de la balise <title> s’affiche ici, dans l’onglet — pas dans la page."
  chrome.append(pastilles, onglet)

  const adresse = document.createElement("div")
  adresse.className = "console-html-adresse"
  adresse.textContent = directives.adresse

  const iframe = document.createElement("iframe")
  iframe.className = "console-html-rendu"
  iframe.setAttribute("sandbox", "allow-same-origin allow-popups allow-popups-to-escape-sandbox")
  iframe.setAttribute("title", "Rendu de la page HTML")
  iframe.setAttribute("loading", "lazy")
  iframe.addEventListener("load", () => ajusterHauteur(iframe))

  fenetre.append(chrome, adresse, iframe)
  espace.append(editeur, fenetre)

  /* --- les objectifs (facultatifs) --- */
  let liste = null
  const cases = []
  if (directives.objectifs.length) {
    liste = document.createElement("ul")
    liste.className = "console-html-objectifs"
    for (const o of directives.objectifs) {
      const li = document.createElement("li")
      li.textContent = o.texte
      liste.appendChild(li)
      cases.push({ li, objectif: o })
    }
  }

  const bilan = document.createElement("p")
  bilan.className = "console-html-bilan"
  bilan.hidden = true

  console_.append(barre, espace)
  if (liste) console_.append(liste, bilan)
  ancre.after(console_)

  /* --- comportement --- */
  const source = () => (editeur.hidden ? directives.corps : editeur.value)

  /**
   * Les objectifs se verifient a CHAQUE frappe, page affichee ou non :
   * un etudiant qui masque le rendu doit voir ses cases se cocher quand
   * meme (defaut corrige le 2026-10-26).
   */
  function verifier(html, doc) {
    if (!cases.length || !doc) return
    let atteints = 0
    for (const c of cases) {
      let ok = false
      try {
        ok = atteint(doc, c.objectif)
      } catch {
        ok = false // selecteur invalide : une faute de l'auteur, pas de l'etudiant
      }
      c.li.classList.toggle("console-html-atteint", ok)
      if (ok) atteints++
    }
    const tous = atteints === cases.length
    const faute = malForme(html)
    const compte = `${atteints} objectif${atteints > 1 ? "s" : ""} sur ${cases.length}`
    bilan.hidden = false
    bilan.textContent =
      tous && !faute
        ? "Tous les objectifs sont atteints. Bravo !"
        : faute
          ? `${compte} — mais le code est mal formé : ${faute} Le navigateur affiche la page quand même ; un logiciel, lui, la rejetterait.`
          : `${compte}.`
    bilan.classList.toggle("console-html-reussi", tous && !faute)
    bilan.classList.toggle("console-html-malforme", !!faute)
  }

  function rendre() {
    const html = source()
    const doc = analyser(html)
    const titre = doc && doc.title ? doc.title.trim() : ""
    onglet.textContent = titre || "Sans titre"
    onglet.classList.toggle("console-html-sans-titre", !titre)
    iframe.srcdoc = preparer(html)
    verifier(html, doc)
  }

  function afficher() {
    fenetre.hidden = false
    bAfficher.textContent = "Masquer la page"
    rendre()
  }

  function masquer() {
    fenetre.hidden = true
    bAfficher.textContent = "Afficher la page"
  }

  bAfficher.addEventListener("click", () => (fenetre.hidden ? afficher() : masquer()))

  function ouvrirEditeur() {
    editeur.value = source()
    editeur.hidden = false
    ancre.hidden = true
    bModifier.hidden = true
    bOrigine.hidden = false
    console_.classList.add("console-html-edition")
    editeur.rows = Math.min(Math.max(editeur.value.split("\n").length + 1, 4), 24)
    afficher()
    editeur.focus()
  }

  bModifier.addEventListener("click", ouvrirEditeur)

  bOrigine.addEventListener("click", () => {
    editeur.value = directives.corps
    editeur.rows = Math.min(Math.max(directives.corps.split("\n").length + 1, 4), 24)
    rendre()
  })

  let minuterie = null
  editeur.addEventListener("input", () => {
    clearTimeout(minuterie)
    minuterie = setTimeout(() => {
      try {
        if (!fenetre.hidden) rendre()
        else verifier(source(), analyser(source()))
      } catch {
        /* le rendu suivant retentera */
      }
    }, DELAI_RENDU)
  })

  // Tabulation : indenter plutot que quitter le champ (Echap puis Tab
  // permet toujours d'en sortir au clavier).
  let echap = false
  editeur.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      echap = true
      return
    }
    if (e.key === "Tab" && !e.shiftKey && !echap) {
      e.preventDefault()
      editeur.setRangeText("  ", editeur.selectionStart, editeur.selectionEnd, "end")
      editeur.dispatchEvent(new Event("input"))
    }
    echap = false
  })

  if (directives.bacASable) ouvrirEditeur()
}

/* ------------------------------------------------------------------ */
/*  Accroche sur le cycle de vie de Quartz                             */
/* ------------------------------------------------------------------ */

function equiperLaPage() {
  try {
    const blocs = document.querySelectorAll("pre[data-language='html']:not([data-console-html])")
    for (const pre of blocs) {
      pre.setAttribute("data-console-html", "")
      try {
        equiper(pre)
      } catch {
        /* un bloc en echec ne doit jamais empecher les autres */
      }
    }
  } catch {
    /* la page doit s'afficher quoi qu'il arrive */
  }
}

try {
  document.addEventListener("nav", equiperLaPage)
  document.addEventListener("render", equiperLaPage)
  if (typeof window.addCleanup === "function") {
    window.addCleanup(() => {
      document.removeEventListener("nav", equiperLaPage)
      document.removeEventListener("render", equiperLaPage)
    })
  }
  // Premier chargement : « nav » a pu etre emis avant l'evaluation du module.
  if (document.readyState !== "loading") equiperLaPage()
  else document.addEventListener("DOMContentLoaded", equiperLaPage)
} catch {
  /* silence : sans console HTML, la page reste complete */
}
