/* =====================================================================
 *  Console SQL du cours — Stratos Solutions
 *
 *  Rend executables, dans la page, les blocs ```sql du cours, au moyen
 *  de sql.js (SQLite compile en WebAssembly). Tout se passe dans le
 *  navigateur : rien n'est televerse, rien n'est partage, rien n'est
 *  conserve d'une visite a l'autre.
 *
 *  PRINCIPE DIRECTEUR : enrichissement progressif.
 *  Ce script n'est JAMAIS necessaire a l'affichage de la page. S'il
 *  echoue, a n'importe quelle etape, la page reste celle qu'elle serait
 *  sans lui : les requetes restent lisibles et leurs resultats sont
 *  imprimes dans le cours. C'est pourquoi tout est enveloppe dans des
 *  try/catch et qu'aucune erreur ne remonte jamais au niveau global.
 * ===================================================================== */

const BASE_URL = "/static/sql/"
const MAX_LIGNES = 50

/** Etat partage, porte par window pour survivre aux navigations SPA. */
const etat = (window.__consoleSql ??= {
  sqlJs: null, // la promesse d'initialisation de sql.js
  bases: new Map(), // nom -> { db, seed, modifiee }
})

/* ------------------------------------------------------------------ */
/*  Chargement paresseux du moteur                                     */
/* ------------------------------------------------------------------ */

function chargerScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = url
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("script introuvable : " + url))
    document.head.appendChild(s)
  })
}

/**
 * Recharge la glue de sql.js depuis zero.
 *
 * Emscripten memorise en interne l'echec de recuperation du .wasm : une
 * fois qu'il a echoue, rappeler initSqlJs echoue encore, meme si le
 * fichier est redevenu accessible. La seule sortie propre est de
 * reevaluer le script, ce qui redefinit initSqlJs avec un etat neuf.
 */
async function rechargerGlue() {
  try {
    delete window.initSqlJs
  } catch {
    window.initSqlJs = undefined
  }
  await chargerScript(BASE_URL + "sql-wasm.js?r=" + Date.now())
}

/**
 * Initialise sql.js une seule fois, quelle que soit la page.
 *
 * En cas d'echec, le cache est VIDE : une coupure reseau passagere ne
 * doit pas condamner la console pour le reste de la session. Le clic
 * suivant refait une tentative complete.
 */
function moteur() {
  etat.sqlJs ??= (async () => {
    if (typeof window.initSqlJs !== "function") {
      await chargerScript(BASE_URL + "sql-wasm.js")
    }
    return window.initSqlJs({ locateFile: (f) => BASE_URL + f })
  })().catch(async (e) => {
    etat.sqlJs = null
    // Repartir d'une glue neuve, sans quoi la tentative suivante
    // echouerait elle aussi (voir rechargerGlue).
    try {
      await rechargerGlue()
    } catch {
      /* la prochaine tentative repartira de zero de toute facon */
    }
    throw e
  })
  return etat.sqlJs
}

/* ------------------------------------------------------------------ */
/*  Les bases                                                          */
/* ------------------------------------------------------------------ */

const FICHIERS = {
  vasseur: "base-vasseur.sql",
  association: "base-association.sql",
}

async function base(nom) {
  let b = etat.bases.get(nom)
  if (b) return b

  const SQL = await moteur()
  const rep = await fetch(BASE_URL + FICHIERS[nom])
  if (!rep.ok) throw new Error("jeu de donnees introuvable (" + rep.status + ")")
  const seed = await rep.text()

  b = { seed, db: null, modifiee: false }
  b.db = new SQL.Database()
  b.db.run(seed)
  // enregistree seulement une fois entierement construite
  etat.bases.set(nom, b)
  return b
}

async function reinitialiser(nom) {
  const b = etat.bases.get(nom)
  if (!b) return
  const SQL = await moteur()
  try {
    b.db.close()
  } catch {
    /* sans importance */
  }
  b.db = new SQL.Database()
  b.db.run(b.seed)
  b.modifiee = false
}

/**
 * Une base modifiee l'est pour TOUTE la page : le bouton de
 * reinitialisation doit donc apparaitre sur chaque bloc qui utilise
 * cette base, et pas seulement sur celui qui l'a modifiee.
 */
function rafraichirReinit() {
  for (const bouton of document.querySelectorAll(".console-sql-alerte")) {
    const nom = bouton.dataset.base
    bouton.hidden = !etat.bases.get(nom)?.modifiee
  }
}

/* ------------------------------------------------------------------ */
/*  Lecture des directives                                             */
/* ------------------------------------------------------------------ */

/**
 * Les directives sont de simples commentaires SQL en tete de bloc.
 * Elles survivent a n'importe quel moteur de rendu, restent visibles
 * pour le lecteur, et sont retirees avant execution.
 */
function lireDirectives(code) {
  const lignes = code.split("\n")
  const d = { base: "vasseur", executable: true, bacASable: false }

  for (const l of lignes) {
    const t = l.trim()
    if (!t.startsWith("--")) break
    const c = t.slice(2).trim().toLowerCase()
    if (c.startsWith("non exécutable") || c.startsWith("non executable")) d.executable = false
    if (c.startsWith("base")) {
      if (c.includes("association")) d.base = "association"
    }
    if (c.startsWith("bac à sable") || c.startsWith("bac a sable")) d.bacASable = true
  }
  return d
}

/** Une requete modifie-t-elle la base ? */
const MODIFIE = /\b(insert|update|delete|drop|alter|create|replace)\b/i

/* ------------------------------------------------------------------ */
/*  Rendu des resultats                                                */
/* ------------------------------------------------------------------ */

function vider(el) {
  while (el.firstChild) el.removeChild(el.firstChild)
}

function messageErreur(zone, texte, aide) {
  vider(zone)
  const p = document.createElement("p")
  p.className = "console-sql-erreur"
  p.textContent = texte
  zone.appendChild(p)
  if (aide) {
    const s = document.createElement("p")
    s.className = "console-sql-aide"
    s.textContent = aide
    zone.appendChild(s)
  }
  zone.hidden = false
}

function rendreTable(zone, res) {
  vider(zone)

  for (const bloc of res) {
    const table = document.createElement("table")
    table.className = "console-sql-table"

    const thead = document.createElement("thead")
    const trh = document.createElement("tr")
    for (const c of bloc.columns) {
      const th = document.createElement("th")
      th.textContent = c
      trh.appendChild(th)
    }
    thead.appendChild(trh)
    table.appendChild(thead)

    const tbody = document.createElement("tbody")
    for (const ligne of bloc.values.slice(0, MAX_LIGNES)) {
      const tr = document.createElement("tr")
      for (const v of ligne) {
        const td = document.createElement("td")
        if (v === null) {
          td.textContent = "NULL"
          td.className = "console-sql-null"
        } else {
          td.textContent = String(v)
          if (typeof v === "number") td.className = "console-sql-nombre"
        }
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    const enveloppe = document.createElement("div")
    enveloppe.className = "console-sql-defilement"
    enveloppe.appendChild(table)
    zone.appendChild(enveloppe)

    const n = bloc.values.length
    const pied = document.createElement("p")
    pied.className = "console-sql-decompte"
    pied.textContent =
      n > MAX_LIGNES
        ? `${n} lignes — les ${MAX_LIGNES} premières sont affichées.`
        : `${n} ligne${n > 1 ? "s" : ""}.`
    zone.appendChild(pied)
  }
  zone.hidden = false
}

/* ------------------------------------------------------------------ */
/*  Construction de la console sous un bloc                            */
/* ------------------------------------------------------------------ */

function equiper(pre) {
  const code = pre.querySelector("code")
  if (!code) return

  const original = code.textContent.replace(/\n$/, "")
  const directives = lireDirectives(original)
  if (!directives.executable) return

  // Le bloc peut etre enveloppe dans un <figure> par le coloriseur.
  const ancre = pre.closest("figure[data-rehype-pretty-code-figure]") ?? pre

  const console_ = document.createElement("div")
  console_.className = "console-sql"

  const barre = document.createElement("div")
  barre.className = "console-sql-barre"

  const bExecuter = document.createElement("button")
  bExecuter.type = "button"
  bExecuter.className = "console-sql-bouton console-sql-executer"
  bExecuter.textContent = "Exécuter"

  const bModifier = document.createElement("button")
  bModifier.type = "button"
  bModifier.className = "console-sql-bouton"
  bModifier.textContent = "Modifier"

  const bOrigine = document.createElement("button")
  bOrigine.type = "button"
  bOrigine.className = "console-sql-bouton console-sql-discret"
  bOrigine.textContent = "Requête d’origine"
  bOrigine.hidden = true

  const bReinit = document.createElement("button")
  bReinit.type = "button"
  bReinit.className = "console-sql-bouton console-sql-alerte"
  bReinit.textContent = "Réinitialiser la base"
  bReinit.dataset.base = directives.base
  bReinit.hidden = true

  const etiquette = document.createElement("span")
  etiquette.className = "console-sql-etiquette"
  etiquette.textContent =
    directives.base === "association" ? "base : association sportive" : "base : Menuiseries Vasseur"

  barre.append(bExecuter, bModifier, bOrigine, bReinit, etiquette)

  const editeur = document.createElement("textarea")
  editeur.className = "console-sql-editeur"
  editeur.spellcheck = false
  editeur.value = original
  editeur.hidden = true
  editeur.setAttribute("aria-label", "Requête SQL modifiable")

  const zone = document.createElement("div")
  zone.className = "console-sql-resultat"
  zone.hidden = true

  console_.append(barre, editeur, zone)
  ancre.after(console_)

  const requete = () => (editeur.hidden ? code.textContent : editeur.value)

  function ouvrirEditeur() {
    editeur.value = requete()
    editeur.hidden = false
    ancre.hidden = true
    bModifier.hidden = true
    bOrigine.hidden = false
    const lignes = editeur.value.split("\n").length
    editeur.rows = Math.min(Math.max(lignes + 1, 3), 20)
    editeur.focus()
  }

  bModifier.addEventListener("click", ouvrirEditeur)

  bOrigine.addEventListener("click", () => {
    editeur.value = original
    editeur.rows = Math.min(Math.max(original.split("\n").length + 1, 3), 20)
  })

  bReinit.addEventListener("click", async () => {
    bReinit.disabled = true
    try {
      await reinitialiser(directives.base)
      rafraichirReinit()
      messageErreur(zone, "Base réinitialisée : toutes les données sont revenues à leur état d’origine.")
      zone.firstChild.className = "console-sql-info"
    } catch (e) {
      messageErreur(zone, "Réinitialisation impossible : " + e.message)
    } finally {
      bReinit.disabled = false
    }
  })

  bExecuter.addEventListener("click", async () => {
    const sql = requete().trim()
    if (!sql) return

    bExecuter.disabled = true
    bExecuter.textContent = "Exécution…"
    try {
      const b = await base(directives.base)
      const res = b.db.exec(sql)

      if (res.length) {
        rendreTable(zone, res)
      } else if (MODIFIE.test(sql)) {
        const n = b.db.getRowsModified()
        messageErreur(
          zone,
          `Requête exécutée. ${n} ligne${n > 1 ? "s" : ""} affectée${n > 1 ? "s" : ""}.`,
        )
        zone.firstChild.className = "console-sql-info"
      } else {
        // Une interrogation qui ne ramene rien : surtout pas getRowsModified(),
        // qui renverrait le compteur de la derniere modification — celui du
        // script de creation de la base. Un etudiant qui se trompe de valeur
        // (« Particulier » au lieu de « particulier ») lirait « 12 lignes
        // affectees » et croirait sa requete juste.
        messageErreur(
          zone,
          "Requête exécutée. Aucune ligne ne correspond.",
          "Vérifiez les valeurs du WHERE : les comparaisons de texte distinguent les majuscules des minuscules.",
        )
        zone.firstChild.className = "console-sql-info"
      }

      if (MODIFIE.test(sql)) b.modifiee = true
      rafraichirReinit()
    } catch (e) {
      if (e && /wasm|fetch|introuvable|WebAssembly|NetworkError|Failed to fetch/i.test(String(e.message))) {
        messageErreur(
          zone,
          "Le moteur SQL n’a pas pu être chargé.",
          "Les résultats imprimés dans le cours font foi — la page reste entièrement utilisable. Vous pouvez réessayer.",
        )
      } else {
        // Erreur SQL : c'est un cas pedagogique, pas une panne.
        messageErreur(zone, "Erreur SQL : " + e.message, "Corrigez la requête et relancez-la.")
      }
    } finally {
      bExecuter.disabled = false
      bExecuter.textContent = "Exécuter"
    }
  })

  bReinit.hidden = !etat.bases.get(directives.base)?.modifiee

  if (directives.bacASable) ouvrirEditeur()
}

/* ------------------------------------------------------------------ */
/*  Accroche sur le cycle de vie de Quartz                             */
/* ------------------------------------------------------------------ */

function equiperLaPage() {
  try {
    const blocs = document.querySelectorAll("pre[data-language='sql']:not([data-console-sql])")
    for (const pre of blocs) {
      pre.setAttribute("data-console-sql", "")
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
  /* silence : sans console SQL, la page reste complete */
}
