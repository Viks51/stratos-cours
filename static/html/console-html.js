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
 *  Les blocs ```xml recoivent une variante (equiperXml, en fin de
 *  fichier) : pas de page a dessiner, mais un logiciel destinataire qui
 *  accepte ou rejette le fichier, et montre les donnees qu'il en tire.
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
  espace.append(numeroterLignes(editeur), fenetre)

  /* --- les objectifs (facultatifs) --- */
  const { liste, cases, bilan } = objectifsDe(directives)

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
    const atteints = cocher(cases, doc)
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
    remplir(editeur, source())
    editeur.hidden = false
    ancre.hidden = true
    bModifier.hidden = true
    bOrigine.hidden = false
    console_.classList.add("console-html-edition")
    afficher()
    editeur.focus()
  }

  bModifier.addEventListener("click", ouvrirEditeur)

  bOrigine.addEventListener("click", () => {
    remplir(editeur, directives.corps)
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

  indenterAuTab(editeur)

  if (directives.bacASable) ouvrirEditeur()
}

/* ------------------------------------------------------------------ */
/*  Pieces communes aux deux consoles                                  */
/* ------------------------------------------------------------------ */

/** La liste des objectifs (vide si le bloc n'en a pas) et son bilan. */
function objectifsDe(directives) {
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

  return { liste, cases, bilan }
}

/** Coche les cases atteintes dans doc (null : aucune) ; rend leur nombre. */
function cocher(cases, doc) {
  let atteints = 0
  for (const c of cases) {
    let ok = false
    try {
      ok = !!doc && atteint(doc, c.objectif)
    } catch {
      ok = false // selecteur invalide : une faute de l'auteur, pas de l'etudiant
    }
    c.li.classList.toggle("console-html-atteint", ok)
    if (ok) atteints++
  }
  return atteints
}

/**
 * Les numeros de ligne, dans une gouttiere a gauche de l'editeur : les
 * messages de la console citent des lignes (« ligne 7 »), l'etudiant doit
 * pouvoir les retrouver. L'editeur ne replie pas les lignes (white-space:
 * pre) : une ligne de texte = une ligne de gouttiere, il suffit d'aligner
 * police, interligne et marge haute, puis de suivre le defilement.
 * Rend l'enveloppe a placer dans la page a la place de l'editeur.
 */
function numeroterLignes(editeur) {
  const saisie = document.createElement("div")
  saisie.className = "console-html-saisie"
  // Une div, pas un <pre> : Quartz habille tous les <pre> du cours.
  const numeros = document.createElement("div")
  numeros.className = "console-html-numeros"
  numeros.setAttribute("aria-hidden", "true")
  saisie.append(numeros, editeur)

  let compte = 0
  const maj = () => {
    const n = editeur.value.split("\n").length
    if (n !== compte) {
      compte = n
      numeros.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n")
      numeros.style.width = Math.max(2, String(n).length) + "ch" // contain: size l'exige
    }
    numeros.scrollTop = editeur.scrollTop
  }
  editeur.addEventListener("input", maj)
  editeur.addEventListener("remplissage", maj)
  editeur.addEventListener("scroll", () => (numeros.scrollTop = editeur.scrollTop))
  maj()
  return saisie
}

/** Remplit l'editeur et le dimensionne a son contenu (4 a 24 lignes). */
function remplir(editeur, texte) {
  editeur.value = texte
  editeur.rows = Math.min(Math.max(texte.split("\n").length + 1, 4), 24)
  editeur.dispatchEvent(new Event("remplissage"))
}

// Tabulation : indenter plutot que quitter le champ (Echap puis Tab
// permet toujours d'en sortir au clavier).
function indenterAuTab(editeur) {
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
}

/* ------------------------------------------------------------------ */
/*  La variante XML : le fichier → le logiciel                         */
/* ------------------------------------------------------------------ */

/**
 * Un bloc ```xml n'a pas de « page » a afficher : il a un destinataire.
 * La console le « transmet au logiciel », qui l'accepte ou le rejette —
 * et, s'il l'accepte, montre les donnees qu'il en a tirees, chacune avec
 * son chemin (commande › ligne › quantite = 11). C'est la suite directe
 * de l'exercice « Le navigateur pardonne » : XML, lui, ne pardonne pas.
 *
 * Memes directives que les blocs ```html (commentaires XML en tete),
 * sauf « adresse », sans objet. Les objectifs portent sur le document
 * XML (selecteurs sensibles a la casse, comme XML) ; un fichier rejete
 * n'en atteint aucun : le logiciel n'en a rien lu.
 *
 * L'arbitre est le DOMParser du navigateur, en mode XML strict. Son
 * message, en anglais et propre a chaque navigateur, n'est pas montre
 * tel quel : xmlMalForme() en donne un en francais, avec la ligne.
 */

const MAX_DONNEES = 60

// Un nom XML : une lettre ou « _ », puis lettres, chiffres, « - », « _ »,
// « . » (et « : », reserve aux espaces de noms).
const NOM_XML = /^[\p{L}_][\p{L}\p{N}._:-]*$/u
const ATTRIBUTS_XML = /^(\s+[\p{L}_][\p{L}\p{N}._:-]*\s*=\s*("[^"<]*"|'[^'<]*'))*\s*$/u
const ENTITE = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/

/**
 * Le fichier est-il bien forme au sens XML ? Meme parti que malForme() :
 * null, ou une phrase qui situe la PREMIERE faute. Mais XML est plus
 * strict que HTML : la casse compte, aucune balise n'est dispensee de
 * fermeture, un seul element racine, des noms sans espace, « & » et « < »
 * reserves.
 */
function xmlMalForme(code) {
  if (/<\?xml[\s?]/.test(code) && !/^<\?xml[\s?]/.test(code)) {
    return "la déclaration <?xml … ?> doit être la toute première chose du fichier, sans espace ni ligne avant elle."
  }
  const blanc = (m) => m.replace(/[^\n]/g, " ")
  const texte = code
    .replace(/<!--[\s\S]*?-->/g, blanc)
    .replace(/<\?[\s\S]*?\?>/g, blanc)
    .replace(/<!DOCTYPE[^>]*>/gi, blanc)
    // Une section CDATA est une donnee : elle compte comme du texte.
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => m.replace(/[^\n]/g, "x"))
  const ligne = (i) => texte.slice(0, i).split("\n").length

  const pile = []
  let racine = null
  let i = 0
  for (;;) {
    const j = texte.indexOf("<", i)
    const morceau = texte.slice(i, j < 0 ? texte.length : j)

    // Le texte entre deux balises
    const debut = morceau.search(/\S/)
    if (debut >= 0 && !pile.length) {
      const extrait = morceau.trim().split("\n")[0].slice(0, 30)
      return `le texte « ${extrait} » (ligne ${ligne(i + debut)}) se trouve hors de l’élément racine : toutes les données doivent tenir dans un seul élément qui englobe tout.`
    }
    const e = morceau.search(ENTITE)
    if (e >= 0) {
      return `le caractère « & » (ligne ${ligne(i + e)}) est réservé : dans une donnée, il s’écrit &amp;.`
    }
    if (j < 0) break

    // La balise
    const l = ligne(j)
    const k = texte.indexOf(">", j)
    const interieur = k < 0 ? "" : texte.slice(j + 1, k)
    if (k < 0 || interieur === "" || /^\s/.test(interieur) || interieur.includes("<")) {
      return `le caractère « < » (ligne ${l}) n’ouvre pas une balise valide : dans une donnée, il s’écrit &lt;, et une balise s’écrit sans espace après « < ».`
    }
    const fermante = interieur.startsWith("/")
    const vide = !fermante && interieur.endsWith("/")
    const corps = interieur.slice(fermante ? 1 : 0, vide ? -1 : undefined)
    const [, nom = "", reste = ""] = corps.match(/^(\S*)([\s\S]*)$/) ?? []

    if (!NOM_XML.test(nom)) {
      return `le nom de balise « ${nom} » (ligne ${l}) n’est pas valide : un nom commence par une lettre et ne contient que des lettres, des chiffres, « - », « _ » ou « . » — ni espace ni apostrophe.`
    }
    if (fermante ? reste.trim() : !ATTRIBUTS_XML.test(reste)) {
      return reste.includes("=")
        ? `la balise <${nom}…> (ligne ${l}) contient un attribut mal écrit : sa valeur s’écrit entre guillemets, nom="valeur".`
        : `la balise <${interieur.trim()}> (ligne ${l}) contient un espace : un nom de balise s’écrit d’un seul tenant (par exemple avec « _ »).`
    }

    if (!fermante) {
      if (!pile.length && racine) {
        return `le fichier contient deux éléments racines, <${racine}> puis <${nom}> (ligne ${l}) : toutes les données doivent tenir dans un seul élément qui englobe tout.`
      }
      if (!pile.length) racine = nom
      if (!vide) pile.push({ nom, l })
    } else {
      const haut = pile[pile.length - 1]
      if (haut && haut.nom === nom) pile.pop()
      else if (haut && haut.nom.toLowerCase() === nom.toLowerCase()) {
        return `la balise </${nom}> (ligne ${l}) ne ferme pas <${haut.nom}> (ligne ${haut.l}) : en XML, majuscules et minuscules comptent.`
      } else if (haut && pile.some((p) => p.nom === nom)) {
        return `la balise <${haut.nom}> (ligne ${haut.l}) n’est pas refermée avant </${nom}> (ligne ${l}).`
      } else {
        return `la balise </${nom}> (ligne ${l}) ferme une balise qui n’a pas été ouverte.`
      }
    }
    i = k + 1
  }

  if (pile.length) {
    const p = pile[pile.length - 1]
    return `la balise <${p.nom}> (ligne ${p.l}) n’est jamais refermée.`
  }
  if (!racine) return "le fichier ne contient aucune donnée balisée."
  return null
}

/**
 * Le verdict du logiciel : { doc } si le fichier est accepte, { faute }
 * sinon. Le DOMParser tranche ; xmlMalForme() ne sert qu'a expliquer.
 */
function transmettre(xml) {
  let doc = null
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml")
  } catch {
    doc = null
  }
  const rejete = !doc || !doc.documentElement || doc.getElementsByTagName("parsererror").length > 0
  if (!rejete) return { doc }
  return {
    faute:
      xmlMalForme(xml) ??
      "le fichier ne respecte pas la syntaxe XML (balises, guillemets ou caractères réservés).",
  }
}

/**
 * Ce que le logiciel a lu : une ligne par donnee, avec son chemin. Les
 * elements freres de meme nom sont numerotes (ligne 1, ligne 2) : c'est
 * ainsi que le logiciel distingue deux lignes de commande.
 */
function lireDonnees(doc) {
  const donnees = []
  function parcourir(el, chemin) {
    for (const a of el.attributes) donnees.push([`${chemin} › @${a.name}`, a.value])
    const enfants = [...el.children]
    if (!enfants.length) {
      donnees.push([chemin, el.textContent.replace(/\s+/g, " ").trim()])
      return
    }
    const total = {}
    for (const c of enfants) total[c.tagName] = (total[c.tagName] ?? 0) + 1
    const vus = {}
    for (const c of enfants) {
      vus[c.tagName] = (vus[c.tagName] ?? 0) + 1
      const nom = total[c.tagName] > 1 ? `${c.tagName} ${vus[c.tagName]}` : c.tagName
      parcourir(c, `${chemin} › ${nom}`)
    }
  }
  parcourir(doc.documentElement, doc.documentElement.tagName)
  return donnees
}

function equiperXml(pre) {
  const code = pre.querySelector("code")
  if (!code) return

  const original = code.textContent.replace(/\n$/, "")
  const directives = lireDirectives(original)
  if (!directives.executable) return

  const ancre = pre.closest("figure[data-rehype-pretty-code-figure]") ?? pre

  const console_ = document.createElement("div")
  console_.className = "console-html console-xml"

  /* --- la barre --- */
  const barre = document.createElement("div")
  barre.className = "console-html-barre"

  const bTransmettre = bouton("Transmettre au logiciel", "console-html-afficher")
  const bModifier = bouton("Modifier")
  const bOrigine = bouton("Code d’origine", "console-html-discret")
  bOrigine.hidden = true

  const etiquette = document.createElement("span")
  etiquette.className = "console-html-etiquette"
  etiquette.textContent = "le fichier → le logiciel"

  barre.append(bTransmettre, bModifier, bOrigine, etiquette)

  /* --- l'espace de travail : editeur (texte) + logiciel (donnees) --- */
  const espace = document.createElement("div")
  espace.className = "console-html-espace"

  const editeur = document.createElement("textarea")
  editeur.className = "console-html-editeur"
  editeur.spellcheck = false
  editeur.value = directives.corps
  editeur.hidden = true
  editeur.setAttribute("aria-label", "Fichier XML modifiable")

  // Meme classe que la fenetre de navigateur : memes regles d'affichage.
  const logiciel = document.createElement("div")
  logiciel.className = "console-html-fenetre console-xml-logiciel"
  logiciel.hidden = true

  const entete = document.createElement("div")
  entete.className = "console-xml-entete"
  entete.textContent = "Logiciel du destinataire — réception du fichier"

  const verdict = document.createElement("p")
  verdict.className = "console-xml-verdict"
  verdict.setAttribute("aria-live", "polite")

  const tableau = document.createElement("table")
  tableau.className = "console-xml-donnees"
  const legende = document.createElement("caption")
  legende.textContent = "Ce que lit le logiciel"
  const corpsTableau = document.createElement("tbody")
  tableau.append(legende, corpsTableau)

  logiciel.append(entete, verdict, tableau)
  espace.append(numeroterLignes(editeur), logiciel)

  /* --- les objectifs (facultatifs) --- */
  const { liste, cases, bilan } = objectifsDe(directives)

  console_.append(barre, espace)
  if (liste) console_.append(liste, bilan)
  ancre.after(console_)

  /* --- comportement --- */
  const source = () => (editeur.hidden ? directives.corps : editeur.value)

  function verifier(resultat) {
    if (!cases.length) return
    const atteints = cocher(cases, resultat.doc)
    const tous = atteints === cases.length
    const compte = `${atteints} objectif${atteints > 1 ? "s" : ""} sur ${cases.length}`
    bilan.hidden = false
    bilan.textContent = resultat.faute
      ? `${compte} — tant que le fichier est rejeté, le logiciel n’en lit aucune donnée.`
      : tous
        ? "Tous les objectifs sont atteints. Bravo !"
        : // Accepte n'est pas juste : une donnee peut etre lue au mauvais
          // endroit (un article sorti de sa <ligne>). Le chemin le montre.
          `${compte} — le fichier est accepté, mais toutes les données ne sont pas là où le logiciel les attend : comparez leur chemin, dans « Ce que lit le logiciel », aux cases restantes.`
    bilan.classList.toggle("console-html-reussi", !resultat.faute && tous)
    bilan.classList.toggle("console-html-malforme", !!resultat.faute)
  }

  function lire() {
    const resultat = transmettre(source())
    logiciel.classList.toggle("console-xml-accepte", !resultat.faute)
    logiciel.classList.toggle("console-xml-rejete", !!resultat.faute)
    corpsTableau.replaceChildren()
    if (resultat.faute) {
      verdict.textContent = `✗ Fichier rejeté : ${resultat.faute} Le logiciel n’en lit aucune donnée.`
      tableau.hidden = true
    } else {
      const donnees = lireDonnees(resultat.doc)
      verdict.textContent = `✓ Fichier accepté : le logiciel en tire ${donnees.length} donnée${donnees.length > 1 ? "s" : ""}, sans intervention humaine.`
      for (const [chemin, valeur] of donnees.slice(0, MAX_DONNEES)) {
        const tr = document.createElement("tr")
        const th = document.createElement("th")
        th.scope = "row"
        th.textContent = chemin
        const td = document.createElement("td")
        td.textContent = valeur || "(vide)"
        td.classList.toggle("console-xml-vide", !valeur)
        tr.append(th, td)
        corpsTableau.appendChild(tr)
      }
      tableau.hidden = false
    }
    verifier(resultat)
  }

  function afficher() {
    logiciel.hidden = false
    bTransmettre.textContent = "Masquer le logiciel"
    lire()
  }

  function masquer() {
    logiciel.hidden = true
    bTransmettre.textContent = "Transmettre au logiciel"
  }

  bTransmettre.addEventListener("click", () => (logiciel.hidden ? afficher() : masquer()))

  function ouvrirEditeur() {
    remplir(editeur, source())
    editeur.hidden = false
    ancre.hidden = true
    bModifier.hidden = true
    bOrigine.hidden = false
    console_.classList.add("console-html-edition")
    afficher()
    editeur.focus()
  }

  bModifier.addEventListener("click", ouvrirEditeur)

  bOrigine.addEventListener("click", () => {
    remplir(editeur, directives.corps)
    lire()
  })

  // Les objectifs suivent la frappe, logiciel affiche ou non.
  let minuterie = null
  editeur.addEventListener("input", () => {
    clearTimeout(minuterie)
    minuterie = setTimeout(() => {
      try {
        if (!logiciel.hidden) lire()
        else verifier(transmettre(source()))
      } catch {
        /* la lecture suivante retentera */
      }
    }, DELAI_RENDU)
  })

  indenterAuTab(editeur)

  if (directives.bacASable) ouvrirEditeur()
}

/* ------------------------------------------------------------------ */
/*  Accroche sur le cycle de vie de Quartz                             */
/* ------------------------------------------------------------------ */

function equiperLaPage() {
  try {
    const blocs = document.querySelectorAll(
      "pre:is([data-language='html'], [data-language='xml']):not([data-console-html])",
    )
    for (const pre of blocs) {
      pre.setAttribute("data-console-html", "")
      try {
        if (pre.getAttribute("data-language") === "xml") equiperXml(pre)
        else equiper(pre)
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
