/* Surface anchors sampled on the FINAL Draco-decoded training V6 mesh.
 * Each surface follows its animated mesh; coordinates are glTF Y-up, metres.
 * u3 support placement is estimated from the manual p.12; button is modelled.
 */
const ANCHORS = [
  {
    "id": "bras",
    "pos": [
      -0.54,
      2.287,
      0.1469836
    ],
    "normal": [
      0,
      0,
      1
    ],
    "surface": "79 0 10637 10639 10638 0.48230179 0.00711614 0.51058206",
    "modelIndex": 0,
    "label": "Mât (bras robotisé)",
    "kind": "component",
    "estimated": false,
    "num": 1,
    "view": {
      "yaw": -35,
      "pitch": 22,
      "dist": 3.2,
      "target": [
        -0.54,
        2.287,
        0.1469836
      ]
    }
  },
  {
    "id": "pince",
    "pos": [
      0.88854,
      2.1151,
      0.0730006
    ],
    "normal": [
      0,
      0,
      1
    ],
    "surface": "66 0 20 21 22 0.00002889 0.49998333 0.49998779",
    "modelIndex": 0,
    "label": "Grappin (pince)",
    "kind": "component",
    "estimated": false,
    "num": 2,
    "view": {
      "yaw": 0,
      "pitch": 15,
      "dist": 1.8,
      "target": [
        0.88854,
        2.1151,
        0.0730006
      ]
    }
  },
  {
    "id": "panier",
    "pos": [
      0.565,
      1.2429382,
      0.657
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "0 0 88478 88479 88480 0.00005289 0.49995163 0.49999548",
    "modelIndex": 0,
    "label": "Bac à tiges",
    "kind": "component",
    "estimated": false,
    "num": 3,
    "view": {
      "yaw": 30,
      "pitch": 35,
      "dist": 3.0,
      "target": [
        0.565,
        1.2429382,
        0.657
      ]
    }
  },
  {
    "id": "stab",
    "pos": [
      -1.53,
      0.26,
      0.8960007
    ],
    "normal": [
      -0.0661058,
      0,
      0.9978126
    ],
    "surface": "26 0 41 43 42 0.49412458 0.50576961 0.0001058",
    "modelIndex": 0,
    "label": "Vérins de stabilisation",
    "kind": "component",
    "estimated": false,
    "num": 4,
    "view": {
      "yaw": -35,
      "pitch": 15,
      "dist": 1.7,
      "target": [
        -1.53,
        0.26,
        0.8960007
      ]
    }
  },
  {
    "id": "boyaux",
    "pos": [
      -3.2000073,
      0.1704534,
      0.3400161
    ],
    "normal": [
      0.0047142,
      0.9999346,
      -0.010424
    ],
    "surface": "117 0 4464 4465 4466 0.52786315 0.47172773 0.00040912",
    "modelIndex": 0,
    "label": "Ombilicaux",
    "kind": "component",
    "estimated": false,
    "num": 5,
    "view": {
      "yaw": -95,
      "pitch": 30,
      "dist": 2.2,
      "target": [
        -3.2000073,
        0.1704534,
        0.3400161
      ]
    }
  },
  {
    "id": "elec",
    "pos": [
      -1.015,
      1.347,
      -0.767
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "12 0 0 1 2 0.00000158 0.49999837 0.50000006",
    "modelIndex": 0,
    "label": "Panneau électrique 24 V",
    "kind": "component",
    "estimated": false,
    "num": 6,
    "view": {
      "yaw": 205,
      "pitch": 14,
      "dist": 1.8,
      "target": [
        -1.015,
        1.347,
        -0.767
      ]
    }
  },
  {
    "id": "remote",
    "pos": [
      -2.3,
      1.5500159,
      1.3816942
    ],
    "normal": [
      0,
      0.3420497,
      0.9396818
    ],
    "surface": "145 0 2942 2943 2944 0.02495124 0.47508184 0.49996693",
    "modelIndex": 0,
    "label": "Télécommande radio",
    "kind": "component",
    "estimated": false,
    "num": 7,
    "view": {
      "yaw": -30,
      "pitch": 25,
      "dist": 1.5,
      "target": [
        -2.3,
        1.5500159,
        1.3816942
      ]
    }
  },
  {
    "id": "u1",
    "pos": [
      -1.025,
      1.057,
      -0.791
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "19 0 16 1 32 0.33333751 0.33333266 0.33332984",
    "modelIndex": 0,
    "label": "Arrêt d’urgence : panneau",
    "kind": "emergency",
    "estimated": false,
    "num": "U",
    "classe": "hs-urgence",
    "encercle": true,
    "view": {
      "yaw": 200,
      "pitch": 12,
      "dist": 1.3,
      "target": [
        -1.025,
        1.057,
        -0.791
      ]
    }
  },
  {
    "id": "u2",
    "pos": [
      -2.3,
      1.4720002,
      1.583
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "167 0 1752 1736 1784 0.39492958 0.15597075 0.44909967",
    "modelIndex": 0,
    "label": "Arrêt d’urgence : télécommande",
    "kind": "emergency",
    "estimated": false,
    "num": "U",
    "classe": "hs-urgence",
    "encercle": true,
    "view": {
      "yaw": -25,
      "pitch": 35,
      "dist": 1.05,
      "target": [
        -2.3,
        1.4720002,
        1.583
      ]
    }
  },
  {
    "id": "u3",
    "pos": [
      1.6940002,
      0.632,
      0.49
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "186 0 16 1 32 0.3333395 0.33333037 0.33333014",
    "modelIndex": 0,
    "label": "Arrêt d’urgence : châssis",
    "kind": "emergency",
    "estimated": true,
    "num": "U",
    "classe": "hs-urgence",
    "encercle": true,
    "view": {
      "yaw": 85,
      "pitch": 12,
      "dist": 1.6,
      "target": [
        1.6940002,
        0.632,
        0.49
      ]
    }
  },
  {
    "id": "u4",
    "pos": [
      -1.5449999,
      0.904,
      -0.247
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "surface": "187 0 16 1 32 0.33333805 0.33333113 0.33333082",
    "modelIndex": 0,
    "label": "Arrêt d’urgence : leviers du mât",
    "kind": "emergency",
    "estimated": false,
    "num": "U",
    "classe": "hs-urgence",
    "encercle": true,
    "view": {
      "yaw": -105,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.5449999,
        0.904,
        -0.247
      ]
    }
  },
  {
    "id": "js1",
    "pos": [
      -2.45,
      1.5595,
      1.46
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "154 0 0 1 2 9.3e-7 0.49999972 0.49999935",
    "modelIndex": 0,
    "label": "JS1 · Manette gauche",
    "kind": "control",
    "estimated": false,
    "num": "JS1",
    "classe": "hs-commande",
    "view": {
      "yaw": -35,
      "pitch": 30,
      "dist": 1.2,
      "target": [
        -2.45,
        1.5595,
        1.46
      ]
    }
  },
  {
    "id": "js2",
    "pos": [
      -2.3000258,
      1.5470001,
      1.4789492
    ],
    "normal": [
      -0.0024336,
      0.3428202,
      0.9393979
    ],
    "surface": "156 0 96 97 98 0.48757262 0 0.51242738",
    "modelIndex": 0,
    "label": "JS2 · Bascule centrale",
    "kind": "control",
    "estimated": false,
    "num": "JS2",
    "classe": "hs-commande",
    "view": {
      "yaw": -30,
      "pitch": 30,
      "dist": 1.2,
      "target": [
        -2.3000258,
        1.5470001,
        1.4789492
      ]
    }
  },
  {
    "id": "js3",
    "pos": [
      -2.15,
      1.5595,
      1.46
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "160 0 0 1 2 9.9e-7 0.49999972 0.49999929",
    "modelIndex": 0,
    "label": "JS3 · Manette droite",
    "kind": "control",
    "estimated": false,
    "num": "JS3",
    "classe": "hs-commande",
    "view": {
      "yaw": -25,
      "pitch": 30,
      "dist": 1.2,
      "target": [
        -2.15,
        1.5595,
        1.46
      ]
    }
  },
  {
    "id": "grip-enable",
    "pos": [
      -2.256,
      1.4427,
      1.588
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "161 0 280 249 296 0.50000144 0.49999623 0.00000233",
    "modelIndex": 0,
    "label": "Bouton vert PINCE",
    "kind": "control",
    "estimated": false,
    "num": "P",
    "classe": "hs-commande",
    "view": {
      "yaw": -25,
      "pitch": 45,
      "dist": 1.0,
      "target": [
        -2.256,
        1.4427,
        1.588
      ]
    }
  },
  {
    "id": "radio-start",
    "pos": [
      -2.5509998,
      1.385,
      1.548
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "surface": "166 0 200 185 216 0.33333871 0.33333153 0.33332977",
    "modelIndex": 0,
    "label": "COMMENCER · Bouton latéral",
    "kind": "control",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -95,
      "pitch": 15,
      "dist": 1.15,
      "target": [
        -2.5509998,
        1.385,
        1.548
      ]
    }
  },
  {
    "id": "horn",
    "pos": [
      -2.3870001,
      1.4724991,
      1.5844999
    ],
    "normal": [
      0.0465235,
      0.9915667,
      0.1209587
    ],
    "surface": "148 0 44061 44062 44063 0.00646488 0.99353512 0",
    "modelIndex": 0,
    "label": "Klaxon / gyrophare",
    "kind": "control",
    "estimated": false,
    "num": "K",
    "classe": "hs-commande",
    "view": {
      "yaw": -30,
      "pitch": 45,
      "dist": 1.05,
      "target": [
        -2.3870001,
        1.4724991,
        1.5844999
      ]
    }
  },
  {
    "id": "source-selector",
    "pos": [
      -1.106,
      1.104,
      -0.7815
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "2 0 4 5 6 0.00000329 0.49999616 0.50000055",
    "modelIndex": 0,
    "label": "Sélecteur LOCAL / REMOTE",
    "kind": "control",
    "estimated": false,
    "num": "L/R",
    "classe": "hs-commande",
    "view": {
      "yaw": 195,
      "pitch": 12,
      "dist": 1.25,
      "target": [
        -1.106,
        1.104,
        -0.7815
      ]
    }
  },
  {
    "id": "rearm",
    "pos": [
      -0.949,
      1.104,
      -0.773
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "18 0 136 121 144 0.49999907 0.50000036 5.6e-7",
    "modelIndex": 0,
    "label": "Réarmement de sécurité",
    "kind": "control",
    "estimated": false,
    "num": "R",
    "classe": "hs-commande",
    "view": {
      "yaw": 195,
      "pitch": 12,
      "dist": 1.25,
      "target": [
        -0.949,
        1.104,
        -0.773
      ]
    }
  },
  {
    "id": "mode-linear",
    "pos": [
      -2.0489999,
      1.385,
      1.548
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "164 0 200 185 216 0.33333727 0.333331 0.33333173",
    "modelIndex": 0,
    "label": "Mode LINÉAIRE",
    "kind": "control",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": 95,
      "pitch": 15,
      "dist": 1.15,
      "target": [
        -2.0489999,
        1.385,
        1.548
      ]
    }
  },
  {
    "id": "mode-direct",
    "pos": [
      -2.0489999,
      1.385,
      1.484
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "163 0 200 185 216 0.33333692 0.33333087 0.33333221",
    "modelIndex": 0,
    "label": "Mode DIRECT",
    "kind": "control",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": 95,
      "pitch": 15,
      "dist": 1.15,
      "target": [
        -2.0489999,
        1.385,
        1.484
      ]
    }
  },
  {
    "id": "mode-standby",
    "pos": [
      -2.0489999,
      1.385,
      1.42
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "165 0 200 185 216 0.33334058 0.33333221 0.33332721",
    "modelIndex": 0,
    "label": "Mode VEILLE",
    "kind": "control",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": 95,
      "pitch": 15,
      "dist": 1.15,
      "target": [
        -2.0489999,
        1.385,
        1.42
      ]
    }
  },
  {
    "id": "front-levers",
    "pos": [
      -1.6011112,
      1.1926547,
      3e-07
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "36 0 542 544 543 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Sept leviers manuels du mât",
    "kind": "control_group",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        3e-07
      ]
    }
  },
  {
    "id": "side-levers",
    "pos": [
      -1.0640002,
      0.9852865,
      0.9730117
    ],
    "normal": [
      -0.0674163,
      -0.2778192,
      0.9582649
    ],
    "surface": "48 0 542 544 543 0.32775103 0.67224897 0",
    "modelIndex": 0,
    "label": "Cinq leviers latéraux",
    "kind": "control_group",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -10,
      "pitch": 15,
      "dist": 1.55,
      "target": [
        -1.0640002,
        0.9852865,
        0.9730117
      ]
    }
  },
  {
    "id": "front01",
    "pos": [
      -1.6011112,
      1.1926547,
      -0.2519997
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "30 0 515 517 516 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Levier frontal 01",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        -0.2519997
      ]
    }
  },
  {
    "id": "front02",
    "pos": [
      -1.6011112,
      1.1926547,
      -0.1679997
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "32 0 523 525 524 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Levier frontal 02",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        -0.1679997
      ]
    }
  },
  {
    "id": "front03",
    "pos": [
      -1.6011112,
      1.1926547,
      -0.0839997
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "34 0 523 525 524 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Levier frontal 03",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        -0.0839997
      ]
    }
  },
  {
    "id": "front04",
    "pos": [
      -1.6011112,
      1.1926547,
      3e-07
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "36 0 542 544 543 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Levier frontal 04",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        3e-07
      ]
    }
  },
  {
    "id": "front05",
    "pos": [
      -1.6011112,
      1.1926547,
      0.0840003
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "38 0 538 540 539 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Levier frontal 05",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        0.0840003
      ]
    }
  },
  {
    "id": "front06",
    "pos": [
      -1.6011112,
      1.1926547,
      0.1680003
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "40 0 519 521 520 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Levier frontal 06",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        0.1680003
      ]
    }
  },
  {
    "id": "front07",
    "pos": [
      -1.6011112,
      1.1926547,
      0.2520003
    ],
    "normal": [
      -0.9729455,
      -0.2204959,
      -0.0689825
    ],
    "surface": "42 0 515 517 516 0.64508319 0.35491681 0",
    "modelIndex": 0,
    "label": "Levier frontal 07",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -100,
      "pitch": 15,
      "dist": 1.5,
      "target": [
        -1.6011112,
        1.1926547,
        0.2520003
      ]
    }
  },
  {
    "id": "side01",
    "pos": [
      -1.2220002,
      0.9852865,
      0.9730117
    ],
    "normal": [
      -0.0674163,
      -0.2778192,
      0.9582649
    ],
    "surface": "44 0 527 529 528 0.32775103 0.67224897 0",
    "modelIndex": 0,
    "label": "Levier latéral 01",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -10,
      "pitch": 15,
      "dist": 1.55,
      "target": [
        -1.2220002,
        0.9852865,
        0.9730117
      ]
    }
  },
  {
    "id": "side02",
    "pos": [
      -1.1430002,
      0.9852865,
      0.9730117
    ],
    "normal": [
      -0.0674163,
      -0.2778192,
      0.9582649
    ],
    "surface": "46 0 527 529 528 0.32775103 0.67224897 0",
    "modelIndex": 0,
    "label": "Levier latéral 02",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -10,
      "pitch": 15,
      "dist": 1.55,
      "target": [
        -1.1430002,
        0.9852865,
        0.9730117
      ]
    }
  },
  {
    "id": "side03",
    "pos": [
      -1.0640002,
      0.9852865,
      0.9730117
    ],
    "normal": [
      -0.0674163,
      -0.2778192,
      0.9582649
    ],
    "surface": "48 0 542 544 543 0.32775103 0.67224897 0",
    "modelIndex": 0,
    "label": "Levier latéral 03",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -10,
      "pitch": 15,
      "dist": 1.55,
      "target": [
        -1.0640002,
        0.9852865,
        0.9730117
      ]
    }
  },
  {
    "id": "side04",
    "pos": [
      -0.9850002,
      0.9852865,
      0.9730117
    ],
    "normal": [
      -0.0674163,
      -0.2778192,
      0.9582649
    ],
    "surface": "50 0 511 513 512 0.32775103 0.67224897 0",
    "modelIndex": 0,
    "label": "Levier latéral 04",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -10,
      "pitch": 15,
      "dist": 1.55,
      "target": [
        -0.9850002,
        0.9852865,
        0.9730117
      ]
    }
  },
  {
    "id": "side05",
    "pos": [
      -0.9060002,
      0.9852865,
      0.9730117
    ],
    "normal": [
      -0.0674163,
      -0.2778192,
      0.9582649
    ],
    "surface": "52 0 549 551 550 0.32775103 0.67224897 0",
    "modelIndex": 0,
    "label": "Levier latéral 05",
    "kind": "manual_lever",
    "estimated": false,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -10,
      "pitch": 15,
      "dist": 1.55,
      "target": [
        -0.9060002,
        0.9852865,
        0.9730117
      ]
    }
  },
  {
    "id": "panel-door",
    "pos": [
      -1.0140001,
      0.914,
      -0.757996
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "10 0 1392 1389 1396 0.33306375 0.33358259 0.33335366",
    "modelIndex": 0,
    "label": "Porte du coffret IHM",
    "kind": "inspection",
    "estimated": true,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": 155,
      "pitch": 12,
      "dist": 2.0,
      "target": [
        -1.1,
        1.23,
        -0.79
      ]
    }
  },
  {
    "id": "receiver",
    "pos": [
      -0.80577,
      1.2979999,
      -0.6340001
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "106 0 9725 9727 9726 0.49998297 0.00001572 0.50000131",
    "modelIndex": 0,
    "label": "Récepteur radio",
    "kind": "inspection",
    "estimated": true,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": 200,
      "pitch": 10,
      "dist": 1.4,
      "target": [
        -0.80577,
        1.2979999,
        -0.6340001
      ]
    }
  },
  {
    "id": "ppu",
    "pos": [
      -1.1392272,
      1.3525999,
      -0.642
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "96 0 2597 2599 2598 0 0.5 0.5",
    "modelIndex": 0,
    "label": "Module PPU",
    "kind": "inspection",
    "estimated": true,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": 185,
      "pitch": 10,
      "dist": 1.4,
      "target": [
        -1.1392272,
        1.3525999,
        -0.642
      ]
    }
  },
  {
    "id": "panel-terminals",
    "pos": [
      -1.0738,
      1.1114498,
      -0.6275013
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "106 0 9700 9701 9702 0.35064979 0.63942021 0.00993",
    "modelIndex": 0,
    "label": "Borniers du coffret",
    "kind": "inspection",
    "estimated": true,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": -10,
      "pitch": 15,
      "dist": 1.55,
      "target": [
        -1.0738,
        1.1114498,
        -0.6275013
      ]
    }
  },
  {
    "id": "rear-hmi",
    "pos": [
      -1.015,
      1.347,
      -0.6621999
    ],
    "normal": [
      0,
      0,
      1
    ],
    "surface": "5 0 1 3 2 0.50000011 6.5e-7 0.49999924",
    "modelIndex": 0,
    "label": "Arrière de l’écran IHM",
    "kind": "inspection",
    "estimated": true,
    "num": "●",
    "classe": "hs-commande",
    "view": {
      "yaw": 90,
      "pitch": 10,
      "dist": 0.82,
      "target": [
        -1.206586480140686,
        1.347000002861023,
        -0.9495567083358765
      ]
    }
  }
];
export const HOTSPOTS = ANCHORS.filter(h => h.kind === 'component');
export const URGENCES = ANCHORS.filter(h => h.kind === 'emergency');
export const CONTROLS = ANCHORS.filter(h => ['control','control_group','inspection'].includes(h.kind));
export const LEVERS = ANCHORS.filter(h => h.kind === 'manual_lever');
export const VUES = {
  "home": {
    "yaw": -35,
    "pitch": 20,
    "dist": 6.5,
    "target": [
      -0.42,
      1.217,
      0.35
    ]
  },
  "profil": {
    "yaw": 0,
    "pitch": 12,
    "dist": 6.0,
    "target": [
      -0.3,
      1.167,
      0.15
    ]
  },
  "avant": {
    "yaw": 90,
    "pitch": 15,
    "dist": 5.7,
    "target": [
      0,
      1.117,
      0.1
    ]
  },
  "arriere": {
    "yaw": -95,
    "pitch": 18,
    "dist": 5.7,
    "target": [
      -0.6,
      1.117,
      0.35
    ]
  },
  "pince": {
    "yaw": -20,
    "pitch": 18,
    "dist": 3.1,
    "target": [
      0.4,
      2.117,
      0
    ]
  },
  "remote": {
    "yaw": -30,
    "pitch": 25,
    "dist": 1.5,
    "target": [
      -2.3,
      1.442,
      1.464
    ]
  },
  "roger": {
    "yaw": 155,
    "pitch": 14,
    "dist": 2.6,
    "target": [
      0.2692,
      0.869,
      -0.727
    ]
  }
};
export const hotspotById = id => ANCHORS.find(h => h.id === id);
