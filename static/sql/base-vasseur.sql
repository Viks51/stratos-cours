-- =====================================================================
--  Base de demonstration : Menuiseries Vasseur
--  Utilisee par le chapitre 2.3 du cours UE8 SIG.
--
--  ATTENTION : ce fichier et les tableaux markdown de la page
--  « Base de donnees - Menuiseries Vasseur.md » doivent rester
--  identiques. Le script verifier-base-sql.mjs le controle a chaque
--  build et fait echouer la publication en cas d'ecart.
-- =====================================================================

-- Sans ce PRAGMA, SQLite n'applique PAS les cles etrangeres. Or le cours
-- montre en 2.3.4 un INSERT vers un client inexistant qui DOIT echouer.
PRAGMA foreign_keys = ON;

CREATE TABLE client (
    id_client     INTEGER PRIMARY KEY,
    nom_client    TEXT    NOT NULL,
    categorie     TEXT    NOT NULL,
    ville         TEXT,
    date_creation TEXT
);

CREATE TABLE chantier (
    id_chantier    INTEGER PRIMARY KEY,
    id_client      INTEGER NOT NULL,
    ville_chantier TEXT,
    date_debut     TEXT,
    date_fin       TEXT,
    montant_ht     REAL,
    FOREIGN KEY (id_client) REFERENCES client (id_client)
);

CREATE TABLE produit (
    ref_produit TEXT PRIMARY KEY,
    designation TEXT NOT NULL,
    matiere     TEXT,
    prix_ht     REAL
);

CREATE TABLE poser (
    id_chantier INTEGER NOT NULL,
    ref_produit TEXT    NOT NULL,
    quantite    INTEGER,
    PRIMARY KEY (id_chantier, ref_produit),
    FOREIGN KEY (id_chantier) REFERENCES chantier (id_chantier),
    FOREIGN KEY (ref_produit) REFERENCES produit  (ref_produit)
);

CREATE TABLE salarie (
    id_salarie     INTEGER PRIMARY KEY,
    nom_salarie    TEXT NOT NULL,
    prenom_salarie TEXT,
    fonction       TEXT,
    site           TEXT,
    date_embauche  TEXT
);

CREATE TABLE intervenir (
    id_chantier       INTEGER NOT NULL,
    id_salarie        INTEGER NOT NULL,
    date_intervention TEXT    NOT NULL,
    nb_heures         REAL,
    PRIMARY KEY (id_chantier, id_salarie, date_intervention),
    FOREIGN KEY (id_chantier) REFERENCES chantier (id_chantier),
    FOREIGN KEY (id_salarie)  REFERENCES salarie  (id_salarie)
);

-- --- CLIENT : 8 lignes ------------------------------------------------
-- Le client 8 n'a aucun chantier : c'est lui qui disparait d'une
-- jointure interne et justifie les jointures externes.
INSERT INTO client (id_client, nom_client, categorie, ville, date_creation) VALUES
 (1, 'Rivière & Fils',           'promoteur',    'Blois',           '2019-03-12'),
 (2, 'Mairie de Joué-lès-Tours', 'collectivité', 'Joué-lès-Tours',  '2020-06-02'),
 (3, 'Delaunay Hervé',           'particulier',  'Tours',           '2024-09-15'),
 (4, 'Constructions Ligéria',    'promoteur',    'Tours',           '2021-01-20'),
 (5, 'Nadaud Sylvie',            'particulier',  'Amboise',         '2025-02-03'),
 (6, 'Collège Balzac',           'collectivité', 'Saint-Avertin',   '2022-11-08'),
 (7, 'Belhadj Karim',            'particulier',  'Blois',           '2025-07-19'),
 (8, 'SCI Le Clos',              'promoteur',    'Vendôme',         '2026-01-05');

-- --- CHANTIER : 10 lignes ---------------------------------------------
-- Quatre chantiers sans date de fin : ils servent a montrer NULL.
INSERT INTO chantier (id_chantier, id_client, ville_chantier, date_debut, date_fin, montant_ht) VALUES
 (101, 1, 'Blois',              '2025-09-01', '2025-11-28',  84500.00),
 (102, 1, 'Blois',              '2026-01-12', NULL,          61200.00),
 (103, 2, 'Joué-lès-Tours',     '2025-10-06', '2025-12-19',  47800.00),
 (104, 3, 'Tours',              '2025-11-03', '2025-11-14',   8900.00),
 (105, 4, 'Tours',              '2025-06-16', '2025-10-31', 128400.00),
 (106, 4, 'Chambray-lès-Tours', '2026-02-02', NULL,          96750.00),
 (107, 5, 'Amboise',            '2026-03-09', NULL,          12300.00),
 (108, 6, 'Saint-Avertin',      '2025-08-25', '2025-10-17',  39600.00),
 (109, 3, 'Tours',              '2026-04-06', NULL,           5400.00),
 (110, 7, 'Blois',              '2026-02-16', '2026-03-27',  14750.00);

-- --- PRODUIT : 8 lignes -----------------------------------------------
-- C-900 n'est pose sur aucun chantier : pendant du client 8.
INSERT INTO produit (ref_produit, designation, matiere, prix_ht) VALUES
 ('F-210', 'Fenêtre 2 vantaux',  'aluminium',  420.00),
 ('F-315', 'Fenêtre 1 vantail',  'aluminium',  310.00),
 ('P-120', 'Porte-fenêtre',      'aluminium',  690.00),
 ('V-400', 'Véranda 12 m²',      'aluminium', 8400.00),
 ('F-510', 'Fenêtre 2 vantaux',  'PVC',        265.00),
 ('F-520', 'Fenêtre 1 vantail',  'PVC',        198.00),
 ('P-530', 'Porte d’entrée',     'PVC',        540.00),
 ('C-900', 'Coulissant 3 rails', 'aluminium', 1250.00);

-- --- POSER : 19 lignes ------------------------------------------------
INSERT INTO poser (id_chantier, ref_produit, quantite) VALUES
 (101, 'F-210', 38),
 (101, 'P-120',  6),
 (102, 'F-210', 24),
 (102, 'F-510', 12),
 (103, 'F-510', 45),
 (103, 'P-530',  4),
 (104, 'F-210',  5),
 (104, 'V-400',  1),
 (105, 'F-315', 62),
 (105, 'F-210', 30),
 (105, 'P-120', 14),
 (106, 'F-510', 40),
 (106, 'P-530',  6),
 (107, 'V-400',  1),
 (108, 'F-520', 28),
 (108, 'P-530',  3),
 (109, 'F-210',  4),
 (110, 'F-510', 16),
 (110, 'P-530',  2);

-- --- SALARIE : 7 lignes -----------------------------------------------
INSERT INTO salarie (id_salarie, nom_salarie, prenom_salarie, fonction, site, date_embauche) VALUES
 (1, 'Belkacem', 'Sofiane', 'responsable administratif', 'Tours', '2015-04-01'),
 (2, 'Perrot',   'Nadia',   'responsable atelier',       'Tours', '2011-09-12'),
 (3, 'Lemoine',  'Thomas',  'technicien informatique',   'Tours', '2008-02-18'),
 (4, 'Fournier', 'Élodie',  'assistante commerciale',    'Blois', '2021-06-07'),
 (5, 'Mercier',  'Yann',    'poseur',                    'Tours', '2018-03-05'),
 (6, 'Aubry',    'Léa',     'poseuse',                   'Tours', '2023-01-16'),
 (7, 'Vasseur',  'Camille', 'gérante',                   'Tours', '2005-09-01');

-- --- INTERVENIR : 12 lignes -------------------------------------------
-- Yann Mercier intervient deux jours de suite sur les chantiers 101 et
-- 105 : sans la date dans la cle primaire, la seconde journee ecraserait
-- la premiere (chapitre 2.2).
INSERT INTO intervenir (id_chantier, id_salarie, date_intervention, nb_heures) VALUES
 (101, 5, '2025-09-02', 7.0),
 (101, 5, '2025-09-03', 7.0),
 (101, 6, '2025-09-03', 6.5),
 (103, 5, '2025-10-07', 8.0),
 (103, 6, '2025-10-08', 7.5),
 (104, 6, '2025-11-04', 4.0),
 (105, 5, '2025-06-17', 8.0),
 (105, 5, '2025-06-18', 8.0),
 (105, 6, '2025-06-18', 7.0),
 (108, 5, '2025-08-26', 6.0),
 (110, 6, '2026-02-17', 7.5),
 (110, 6, '2026-02-18', 5.0);
