-- =====================================================================
--  Base d'exercices : association sportive
--  Utilisee par les cas pratiques 7 a 10 du chapitre 2.3.
--
--  Les donnees sont calibrees pour que CHAQUE reponse des corriges soit
--  verifiable. Ne pas modifier les volumes sans relire
--  « Corriges - UE8 SIG - Partie 2.md ».
--
--  Reperes de controle :
--    - Judo compte 10 adherents  -> seule section « de plus de 8 »
--    - Villeneuve n'a AUCUNE section -> disparait d'une jointure interne
--    - cotisations reglees : Judo 2390 EUR, Natation 1930 EUR,
--      Escalade 1010 EUR, Tir a l'arc 430 EUR
--      -> seules Judo et Natation depassent 1500 EUR
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE entraineur (
    NumEntraineur INTEGER PRIMARY KEY,
    NomEntraineur TEXT NOT NULL,
    Diplome       TEXT
);

CREATE TABLE section (
    NumSection     INTEGER PRIMARY KEY,
    LibelleSection TEXT NOT NULL,
    NumEntraineur  INTEGER,
    FOREIGN KEY (NumEntraineur) REFERENCES entraineur (NumEntraineur)
);

CREATE TABLE adherent (
    NumAdherent    INTEGER PRIMARY KEY,
    NomAdherent    TEXT NOT NULL,
    PrenomAdherent TEXT,
    DateNaissance  TEXT,
    NumSection     INTEGER,
    FOREIGN KEY (NumSection) REFERENCES section (NumSection)
);

CREATE TABLE cotisation (
    NumAdherent      INTEGER NOT NULL,
    Saison           TEXT    NOT NULL,
    MontantCotisation REAL,
    DateReglement    TEXT,
    PRIMARY KEY (NumAdherent, Saison),
    FOREIGN KEY (NumAdherent) REFERENCES adherent (NumAdherent)
);

-- --- ENTRAINEUR : 3 lignes --------------------------------------------
INSERT INTO entraineur (NumEntraineur, NomEntraineur, Diplome) VALUES
 (1, 'Vaillant', 'BEES 2e degré'),
 (2, 'Osmont',   'BPJEPS'),
 (3, 'Ferreira', 'DEJEPS');

-- --- SECTION : 4 lignes -----------------------------------------------
INSERT INTO section (NumSection, LibelleSection, NumEntraineur) VALUES
 (1, 'Judo',        1),
 (2, 'Natation',    2),
 (3, 'Escalade',    3),
 (4, 'Tir à l’arc', 2);

-- --- ADHERENT : 23 lignes ---------------------------------------------
-- Repartition : Judo 10, Natation 6, Escalade 4, Tir a l'arc 2,
-- et Villeneuve sans section (NumSection NULL).
INSERT INTO adherent (NumAdherent, NomAdherent, PrenomAdherent, DateNaissance, NumSection) VALUES
  (1, 'Moreau',     'Lucas',    '1998-04-12', 1),
  (2, 'Marchand',   'Inès',     '2003-09-27', 1),
  (3, 'Bertin',     'Hugo',     '1995-01-08', 1),
  (4, 'Caron',      'Léa',      '2004-06-15', 1),
  (5, 'Meunier',    'Théo',     '2001-11-30', 1),
  (6, 'Dubreuil',   'Camille',  '1999-03-22', 1),
  (7, 'Fontaine',   'Jade',     '2005-08-04', 1),
  (8, 'Gauthier',   'Noah',     '1997-12-19', 1),
  (9, 'Hamon',      'Louise',   '2002-05-11', 1),
 (10, 'Imbert',     'Raphaël',  '2000-02-28', 1),
 (11, 'Jourdan',    'Manon',    '1996-07-03', 2),
 (12, 'Klein',      'Ethan',    '2003-01-17', 2),
 (13, 'Lemoine',    'Alice',    '1994-10-25', 2),
 (14, 'Masson',     'Gabriel',  '2006-04-09', 2),
 (15, 'Nicolas',    'Chloé',    '1999-09-14', 2),
 (16, 'Olivier',    'Adam',     '2001-06-21', 2),
 (17, 'Perrin',     'Sarah',    '1993-02-06', 3),
 (18, 'Quintin',    'Tom',      '2004-11-23', 3),
 (19, 'Renaud',     'Emma',     '1998-08-30', 3),
 (20, 'Sanchez',    'Nathan',   '2002-03-12', 3),
 (21, 'Thibault',   'Zoé',      '1991-05-19', 4),
 (22, 'Ubertini',   'Marius',   '2005-12-01', 4),
 (23, 'Villeneuve', 'Paul',     '1997-06-08', NULL);

-- --- COTISATION : 37 lignes -------------------------------------------
-- Saison 2025-2026 : les 23 adherents. Quatre impayes (DateReglement NULL).
INSERT INTO cotisation (NumAdherent, Saison, MontantCotisation, DateReglement) VALUES
  (1, '2025-2026', 180.00, '2025-09-15'),
  (2, '2025-2026', 180.00, '2025-09-18'),
  (3, '2025-2026', 180.00, '2025-09-20'),
  (4, '2025-2026', 180.00, NULL),
  (5, '2025-2026', 180.00, '2025-10-02'),
  (6, '2025-2026', 180.00, '2025-09-25'),
  (7, '2025-2026', 180.00, '2025-10-08'),
  (8, '2025-2026', 180.00, NULL),
  (9, '2025-2026', 180.00, '2025-09-30'),
 (10, '2025-2026', 180.00, '2025-10-12'),
 (11, '2025-2026', 210.00, '2025-09-16'),
 (12, '2025-2026', 210.00, '2025-09-22'),
 (13, '2025-2026', 210.00, '2025-10-01'),
 (14, '2025-2026', 210.00, NULL),
 (15, '2025-2026', 210.00, '2025-09-28'),
 (16, '2025-2026', 210.00, '2025-10-05'),
 (17, '2025-2026', 165.00, '2025-09-19'),
 (18, '2025-2026', 165.00, '2025-09-24'),
 (19, '2025-2026', 165.00, '2025-10-03'),
 (20, '2025-2026', 165.00, '2025-10-10'),
 (21, '2025-2026', 140.00, '2025-09-21'),
 (22, '2025-2026', 140.00, '2025-09-26'),
 (23, '2025-2026', 150.00, '2025-10-15');

-- Saison 2026-2027 : 14 adherents seulement (les renouvellements).
INSERT INTO cotisation (NumAdherent, Saison, MontantCotisation, DateReglement) VALUES
  (1, '2026-2027', 190.00, '2026-09-14'),
  (2, '2026-2027', 190.00, '2026-09-17'),
  (3, '2026-2027', 190.00, NULL),
  (5, '2026-2027', 190.00, '2026-09-21'),
  (6, '2026-2027', 190.00, '2026-09-24'),
  (9, '2026-2027', 190.00, '2026-10-01'),
 (11, '2026-2027', 220.00, '2026-09-15'),
 (12, '2026-2027', 220.00, '2026-09-19'),
 (15, '2026-2027', 220.00, '2026-09-23'),
 (16, '2026-2027', 220.00, '2026-09-29'),
 (17, '2026-2027', 175.00, '2026-09-16'),
 (18, '2026-2027', 175.00, '2026-09-25'),
 (19, '2026-2027', 175.00, NULL),
 (21, '2026-2027', 150.00, '2026-09-18');
