/* Surface anchors sampled on the FINAL Draco-decoded training V11 mesh.
 * Each surface follows its animated mesh; coordinates are glTF Y-up, metres.
 * u3 support placement is estimated from the manual p.12; button is modelled.
 */
const ANCHORS = [
  {
    "id": "bras",
    "pos": [
      -0.598683,
      2.2028855,
      0.128246
    ],
    "normal": [
      -0.3194678,
      0.6308209,
      0.7071105
    ],
    "surface": "90 0 10637 10639 10638 0.48230356 0.0071763 0.51052014",
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
        -0.598683,
        2.2028855,
        0.128246
      ]
    }
  },
  {
    "id": "pince",
    "pos": [
      0.88854,
      1.9150999,
      0.0730006
    ],
    "normal": [
      0,
      0,
      1
    ],
    "surface": "66 0 20 21 22 0.00002381 0.49998927 0.49998692",
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
        1.9150999,
        0.0730006
      ]
    }
  },
  {
    "id": "panier",
    "pos": [
      0.433,
      0.9339382,
      0.657
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "0 0 92809 92810 92811 0.00005306 0.49995143 0.49999551",
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
        0.433,
        0.9339382,
        0.657
      ]
    }
  },
  {
    "id": "stab",
    "pos": [
      -1.2015601,
      0.26,
      0.6820007
    ],
    "normal": [
      -0.0661058,
      0,
      0.9978126
    ],
    "surface": "26 0 63 64 65 0.49412461 0.50577685 0.00009854",
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
        -1.2015601,
        0.26,
        0.6820007
      ]
    }
  },
  {
    "id": "boyaux",
    "pos": [
      -3.2262592,
      0.089158,
      0.402734
    ],
    "normal": [
      0.4979058,
      0.1241564,
      -0.8582978
    ],
    "surface": "171 0 82905 82906 82907 0.9991356 0.00061867 0.00024573",
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
        -3.2262592,
        0.089158,
        0.402734
      ]
    }
  },
  {
    "id": "elec",
    "pos": [
      -1.015,
      1.1516,
      -0.767
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "12 0 0 1 2 0.00000165 0.49999835 0.5",
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
        1.1516,
        -0.767
      ]
    }
  },
  {
    "id": "remote",
    "pos": [
      -1.97156,
      1.5504281,
      1.3828267
    ],
    "normal": [
      0,
      0.3420203,
      0.9396925
    ],
    "surface": "192 0 3 4 5 0.49999998 0.00011878 0.49988124",
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
        -1.97156,
        1.5504281,
        1.3828267
      ]
    }
  },
  {
    "id": "u1",
    "pos": [
      -1.025,
      0.9196001,
      -0.791
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "19 0 16 1 32 0.33333647 0.33333342 0.33333012",
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
        0.9196001,
        -0.791
      ]
    }
  },
  {
    "id": "u2",
    "pos": [
      -1.97156,
      1.4720002,
      1.5829999
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "209 0 3024 3025 3026 0.44910091 0.39492759 0.1559715",
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
        -1.97156,
        1.4720002,
        1.5829999
      ]
    }
  },
  {
    "id": "u3",
    "pos": [
      1.3845602,
      0.632,
      0.49
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "228 0 16 1 32 0.33333936 0.33333112 0.33332952",
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
        1.3845602,
        0.632,
        0.49
      ]
    }
  },
  {
    "id": "u4",
    "pos": [
      -1.5449999,
      0.704,
      -0.247
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "surface": "229 0 16 1 32 0.33333815 0.33333078 0.33333107",
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
        0.704,
        -0.247
      ]
    }
  },
  {
    "id": "js1",
    "pos": [
      -2.1215601,
      1.5595,
      1.46
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "196 0 0 1 2 0.00000106 0.50000027 0.49999867",
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
        -2.1215601,
        1.5595,
        1.46
      ]
    }
  },
  {
    "id": "js2",
    "pos": [
      -1.971586,
      1.536999,
      1.4856231
    ],
    "normal": [
      0,
      0.9612821,
      -0.2755663
    ],
    "surface": "197 0 8 9 10 0.49922875 0.00020612 0.50056513",
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
        -1.971586,
        1.536999,
        1.4856231
      ]
    }
  },
  {
    "id": "js3",
    "pos": [
      -1.8215603,
      1.5595,
      1.46
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "202 0 0 1 2 0.00000181 0.50000027 0.49999792",
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
        -1.8215603,
        1.5595,
        1.46
      ]
    }
  },
  {
    "id": "grip-enable",
    "pos": [
      -1.9275601,
      1.4427,
      1.5880001
    ],
    "normal": [
      0,
      1,
      0
    ],
    "surface": "203 0 372 373 374 0.5 0 0.5",
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
        -1.9275601,
        1.4427,
        1.5880001
      ]
    }
  },
  {
    "id": "radio-start",
    "pos": [
      -2.2225599,
      1.385,
      1.548
    ],
    "normal": [
      -1,
      0,
      0
    ],
    "surface": "208 0 276 277 278 0.33333089 0.33333829 0.33333082",
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
        -2.2225599,
        1.385,
        1.548
      ]
    }
  },
  {
    "id": "horn",
    "pos": [
      -2.0585602,
      1.4724991,
      1.5844997
    ],
    "normal": [
      0.0465235,
      0.9915667,
      0.1209587
    ],
    "surface": "190 0 68703 68704 68705 0.00630244 0.99369756 0",
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
        -2.0585602,
        1.4724991,
        1.5844997
      ]
    }
  },
  {
    "id": "source-selector",
    "pos": [
      -1.1059999,
      0.9572,
      -0.778
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "1 0 8 1 16 2e-8 0.49999993 0.50000005",
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
        -1.1059999,
        0.9572,
        -0.778
      ]
    }
  },
  {
    "id": "rearm",
    "pos": [
      -0.949,
      0.9572,
      -0.773
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "18 0 180 181 182 0.50000003 8e-8 0.49999989",
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
        0.9572,
        -0.773
      ]
    }
  },
  {
    "id": "mode-linear",
    "pos": [
      -1.7205599,
      1.385,
      1.548
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "206 0 276 277 278 0.33333083 0.33333833 0.33333083",
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
        -1.7205599,
        1.385,
        1.548
      ]
    }
  },
  {
    "id": "mode-direct",
    "pos": [
      -1.7205599,
      1.385,
      1.484
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "205 0 276 277 278 0.33333083 0.33333833 0.33333083",
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
        -1.7205599,
        1.385,
        1.484
      ]
    }
  },
  {
    "id": "mode-standby",
    "pos": [
      -1.7205599,
      1.385,
      1.42
    ],
    "normal": [
      1,
      0,
      0
    ],
    "surface": "207 0 276 277 278 0.33332535 0.33334234 0.3333323",
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
        -1.7205599,
        1.385,
        1.42
      ]
    }
  },
  {
    "id": "front-levers",
    "pos": [
      -1.5979086,
      0.9929894,
      0
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "36 0 798 799 800 0.00000457 0.39218292 0.60781251",
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
        -1.5979086,
        0.9929894,
        0
      ]
    }
  },
  {
    "id": "side-levers",
    "pos": [
      -1.064,
      0.7852865,
      0.9730116
    ],
    "normal": [
      0.0672932,
      -0.2778215,
      0.9582728
    ],
    "surface": "48 0 798 799 800 0.00006423 0.67224067 0.3276951",
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
        -1.064,
        0.7852865,
        0.9730116
      ]
    }
  },
  {
    "id": "front01",
    "pos": [
      -1.5979086,
      0.9929894,
      -0.252
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "30 0 828 829 830 0.00001141 0.39217856 0.60781003",
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
        -1.5979086,
        0.9929894,
        -0.252
      ]
    }
  },
  {
    "id": "front02",
    "pos": [
      -1.5979086,
      0.9929894,
      -0.168
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "32 0 843 844 845 0.00000586 0.39218019 0.60781394",
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
        -1.5979086,
        0.9929894,
        -0.168
      ]
    }
  },
  {
    "id": "front03",
    "pos": [
      -1.5979086,
      0.9929894,
      -0.084
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "34 0 837 838 839 0.00000658 0.39218148 0.60781194",
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
        -1.5979086,
        0.9929894,
        -0.084
      ]
    }
  },
  {
    "id": "front04",
    "pos": [
      -1.5979086,
      0.9929894,
      0
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "36 0 798 799 800 0.00000457 0.39218292 0.60781251",
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
        -1.5979086,
        0.9929894,
        0
      ]
    }
  },
  {
    "id": "front05",
    "pos": [
      -1.5979085,
      0.9929895,
      0.084
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "38 0 798 799 800 0.00000636 0.39218458 0.60780906",
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
        -1.5979085,
        0.9929895,
        0.084
      ]
    }
  },
  {
    "id": "front06",
    "pos": [
      -1.5979085,
      0.9929895,
      0.168
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "40 0 834 835 836 0.00000638 0.3921859 0.60780771",
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
        -1.5979085,
        0.9929895,
        0.168
      ]
    }
  },
  {
    "id": "front07",
    "pos": [
      -1.5979085,
      0.9929895,
      0.252
    ],
    "normal": [
      -0.9859298,
      -0.1601872,
      0.0477746
    ],
    "surface": "42 0 828 829 830 0.00001198 0.39218693 0.6078011",
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
        -1.5979085,
        0.9929895,
        0.252
      ]
    }
  },
  {
    "id": "side01",
    "pos": [
      -1.222,
      0.7852865,
      0.9730116
    ],
    "normal": [
      0.0672932,
      -0.2778215,
      0.9582728
    ],
    "surface": "44 0 843 844 845 0.00006423 0.67224067 0.3276951",
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
        -1.222,
        0.7852865,
        0.9730116
      ]
    }
  },
  {
    "id": "side02",
    "pos": [
      -1.143,
      0.7852865,
      0.9730116
    ],
    "normal": [
      0.0672932,
      -0.2778215,
      0.9582728
    ],
    "surface": "46 0 849 850 851 0.00006423 0.67224067 0.3276951",
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
        -1.143,
        0.7852865,
        0.9730116
      ]
    }
  },
  {
    "id": "side03",
    "pos": [
      -1.064,
      0.7852865,
      0.9730116
    ],
    "normal": [
      0.0672932,
      -0.2778215,
      0.9582728
    ],
    "surface": "48 0 798 799 800 0.00006423 0.67224067 0.3276951",
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
        -1.064,
        0.7852865,
        0.9730116
      ]
    }
  },
  {
    "id": "side04",
    "pos": [
      -0.985,
      0.7852865,
      0.9730116
    ],
    "normal": [
      0.0672932,
      -0.2778215,
      0.9582728
    ],
    "surface": "50 0 822 823 824 0.00006423 0.67224067 0.3276951",
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
        -0.985,
        0.7852865,
        0.9730116
      ]
    }
  },
  {
    "id": "side05",
    "pos": [
      -0.906,
      0.7852865,
      0.9730116
    ],
    "normal": [
      0.0672932,
      -0.2778215,
      0.9582728
    ],
    "surface": "52 0 810 811 812 0.00006423 0.67224067 0.3276951",
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
        -0.906,
        0.7852865,
        0.9730116
      ]
    }
  },
  {
    "id": "panel-door",
    "pos": [
      -1.0140001,
      0.8052,
      -0.757999
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "10 0 1394 1391 1398 0.33352435 0.33315891 0.33331674",
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
        -1.0149999856948853,
        1.0499998331069946,
        -0.7900000214576721
      ]
    }
  },
  {
    "id": "receiver",
    "pos": [
      -0.80577,
      1.1123999,
      -0.6325021
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "122 0 261 262 263 0.49998957 0.00001495 0.49999548",
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
        1.1123999,
        -0.6325021
      ]
    }
  },
  {
    "id": "ppu",
    "pos": [
      -1.13946,
      1.1560799,
      -0.6279997
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "126 0 21741 21742 21743 0.49998965 0.00000536 0.50000499",
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
        -1.13946,
        1.1560799,
        -0.6279997
      ]
    }
  },
  {
    "id": "panel-terminals",
    "pos": [
      -1.0738,
      0.9632898,
      -0.6264983
    ],
    "normal": [
      0,
      0,
      -1
    ],
    "surface": "128 0 14742 14743 14744 0.49220542 0.1272719 0.38052267",
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
        0.9632898,
        -0.6264983
      ]
    }
  },
  {
    "id": "rear-hmi",
    "pos": [
      -1.015,
      1.1516,
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
      "dist": 0.9,
      "target": [
        -1.2304952144622803,
        1.1516000032424927,
        -0.9474649429321289
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
    "dist": 7.5,
    "target": [
      -0.42,
      1.45,
      0.35
    ]
  },
  "profil": {
    "yaw": 0,
    "pitch": 12,
    "dist": 5.9,
    "target": [
      -0.3,
      1.2,
      0.15
    ]
  },
  "avant": {
    "yaw": 90,
    "pitch": 15,
    "dist": 5.7,
    "target": [
      0,
      1.05,
      0.1
    ]
  },
  "arriere": {
    "yaw": -95,
    "pitch": 18,
    "dist": 5.7,
    "target": [
      -0.6,
      1.05,
      0.35
    ]
  },
  "pince": {
    "yaw": -20,
    "pitch": 18,
    "dist": 3.1,
    "target": [
      0.8885400295257568,
      1.915099859237671,
      0.0729999989271164
    ]
  },
  "remote": {
    "yaw": -30,
    "pitch": 25,
    "dist": 1.5,
    "target": [
      -1.971560001373291,
      1.5504282712936401,
      1.3828271627426147
    ]
  },
  "tripod": {
    "yaw": -30,
    "pitch": 20,
    "dist": 3.8,
    "target": [
      -1.971560001373291,
      0.82,
      1.3828271627426147
    ]
  },
  "roger": {
    "yaw": 155,
    "pitch": 14,
    "dist": 2.6,
    "target": [
      0.1372,
      0.65,
      -0.727
    ]
  },
  "hydraulique": {
    "yaw": 0,
    "pitch": 10,
    "dist": 1.85,
    "target": [
      -0.2943863570690155,
      1.9119279384613037,
      0.15000000596046448
    ]
  },
  "distributeurs": {
    "yaw": -105,
    "pitch": 16,
    "dist": 1.65,
    "target": [
      -1.2405864000320435,
      1.0701502561569214,
      -0.004367277026176453
    ]
  }
};
export const hotspotById = id => ANCHORS.find(h => h.id === id);
