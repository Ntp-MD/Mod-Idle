window.PAWN_STUDY = {
  "schemaVersion": 1,
  "status": "runtime-default",
  "runtimeIntegrated": true,
  "generator": "ImageGen",
  "speciesCount": 36,
  "characterCount": 37,
  "variantCount": 109,
  "directions": [
    "south",
    "south-east",
    "east",
    "north-east",
    "north",
    "north-west",
    "west",
    "south-west"
  ],
  "atlasLayout": "Per identity: 2x2 cardinal or 4x2 eight-direction row-major atlas",
  "frameSize": 256,
  "anchor": [
    128,
    224
  ],
  "scalePolicy": "One shared scale per character; species are normalized for comparison, not gameplay size.",
  "motionPolicy": "One static image per facing; idle/walk/attack/hit/death preview uses whole-sprite transforms, not authored limb animation.",
  "alphaPolicy": "Remove border-connected near-white pixels, inset mask by one source pixel, keep silhouette parts connected to the main body so detached ground shadows are dropped. Production edge cleanup still requires review.",
  "promptBrief": "Species: restyle the canonical identity as an original minimalist colony-sim pawn. Variants: staff sheet supplies the pawn style and anatomy; existing draft art supplies identity only. Exactly four full views on white in south/north/west/east order. Humanoids omit articulated limbs; beasts retain their body plan. No weapons, text, grids, shadows or scene.",
  "limitations": [
    "Generated views are approximate, not certified orthographic rotations.",
    "Variants are generated from draft atlases where no reference.png exists, so identity fidelity is approximate.",
    "No gameplay/runtime size, collision, weapon sockets, animation timing or camera calibration is implied.",
    "No weapon sheets or articulated animation frames are included."
  ],
  "entries": [
    {
      "id": "player",
      "name": "Player",
      "race": "player",
      "source": "archive/art-reference/players/body/idle/south.png",
      "sourceSha256": "1dc20d2c7fba317a1199a934f5232f4e186ae0193baf953c7002890aec96bb27",
      "generatedSource": "docs/art-reference/pawn-study/generation/modworld-pawn-player-four-views_1794027784824_711160ef.png",
      "sheetSha256": "7a0041a759cc1049b7ff6fc4be079add4c4a29ccb27f8094b9452af42578b5b5",
      "sheet": "sheets/player.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-player-diagonals.png",
      "diagonalSheetSha256": "0f4c931043a915421dcbd391b2c7a151aa86d6f10c609d0c8b123e83b510e08f",
      "atlas": "atlases/player.png",
      "sourceBounds": [
        [
          67,
          45,
          189,
          224
        ],
        [
          74,
          32,
          183,
          224
        ],
        [
          78,
          34,
          178,
          224
        ],
        [
          72,
          34,
          185,
          224
        ],
        [
          70,
          37,
          186,
          224
        ],
        [
          76,
          32,
          180,
          224
        ],
        [
          78,
          32,
          178,
          224
        ],
        [
          75,
          32,
          181,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "goblin",
      "name": "Goblin",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/goblin/goblin/reference.png",
      "sourceSha256": "5e7bca2a19971f05d3f03bdf571f382da649eea8590e9ac6a799be0eda9633d7",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-goblin_1794027944995_48f32195.png",
      "sheetSha256": "e5ec4882add13d461c2c82c2e69dc9ff2bb382390d0c18820fd1965aa5dc00cd",
      "sheet": "sheets/goblin.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-goblin-diagonals.png",
      "diagonalSheetSha256": "c419b9bf4ba622c8b9c0d4e8c8815daa9f57119d165fbff336ca31bf2ff2aaa2",
      "atlas": "atlases/goblin.png",
      "sourceBounds": [
        [
          28,
          66,
          228,
          224
        ],
        [
          52,
          64,
          204,
          224
        ],
        [
          63,
          64,
          194,
          224
        ],
        [
          52,
          64,
          205,
          224
        ],
        [
          29,
          67,
          227,
          224
        ],
        [
          51,
          64,
          205,
          224
        ],
        [
          62,
          65,
          194,
          224
        ],
        [
          52,
          64,
          204,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "orc",
      "name": "Orc",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/orc/orc/reference.png",
      "sourceSha256": "4322e516a6ddba784ea19fc158144b0ece73ca9c62a3fb17750ae74f71442ce3",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-orc-refined_1794029704145_2a91635f.png",
      "sheetSha256": "ec16edc088a88e577394b8b421249c0a56b6f17447178c40040da026bbc20837",
      "sheet": "sheets/orc.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-orc-diagonals.png",
      "diagonalSheetSha256": "fafa9ebe7e61dd7d0b849cdde3d3a549b4b68c84d2f82e9878a723d95402a7a0",
      "atlas": "atlases/orc.png",
      "sourceBounds": [
        [
          70,
          32,
          187,
          224
        ],
        [
          72,
          32,
          185,
          224
        ],
        [
          72,
          35,
          184,
          224
        ],
        [
          71,
          30,
          185,
          224
        ],
        [
          71,
          35,
          186,
          224
        ],
        [
          72,
          32,
          185,
          224
        ],
        [
          72,
          35,
          185,
          224
        ],
        [
          72,
          33,
          184,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "kobold",
      "name": "Kobold",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/kobold/kobold/reference.png",
      "sourceSha256": "e592b4939998e4ab1ca3b66e1819ebf5bfa8ad92d555bce1b935354470068ea0",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-kobold_1794027996320_2dc7d4e1.png",
      "sheetSha256": "ecaa2bf63a8c32d1a713efc644963c0543702bd4197f743438ff40f7f3122356",
      "sheet": "sheets/kobold.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-kobold-diagonals.png",
      "diagonalSheetSha256": "20f16599e516bbf444d1cec69b74f42798d748f0417db5f550addb3759c660d0",
      "atlas": "atlases/kobold.png",
      "sourceBounds": [
        [
          28,
          58,
          228,
          224
        ],
        [
          44,
          51,
          213,
          224
        ],
        [
          45,
          52,
          211,
          224
        ],
        [
          31,
          51,
          226,
          224
        ],
        [
          32,
          57,
          224,
          224
        ],
        [
          44,
          51,
          212,
          224
        ],
        [
          44,
          51,
          213,
          224
        ],
        [
          43,
          51,
          213,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ogre",
      "name": "Ogre",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/ogre/ogre/reference.png",
      "sourceSha256": "e514633a79a4e6a4ae90b395bfaf0560e5223f46e28c251d2b493f60292cf917",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-ogre_1794028029758_3c9fe627.png",
      "sheetSha256": "bfec5ed186c6f2f8da7b035ed5da9b41e3a8a33dfab3d349d34bfa60a9096f8d",
      "sheet": "sheets/ogre.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ogre-diagonals.png",
      "diagonalSheetSha256": "23baf398f850a285095c91c7593e1e7fc3a77f802ebaa584dd38986b0378dd60",
      "atlas": "atlases/ogre.png",
      "sourceBounds": [
        [
          64,
          37,
          192,
          224
        ],
        [
          66,
          35,
          191,
          224
        ],
        [
          67,
          32,
          189,
          224
        ],
        [
          66,
          35,
          191,
          224
        ],
        [
          66,
          36,
          190,
          224
        ],
        [
          63,
          29,
          193,
          224
        ],
        [
          68,
          32,
          189,
          224
        ],
        [
          63,
          29,
          193,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "troll",
      "name": "Troll",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/troll/troll/reference.png",
      "sourceSha256": "cfd5ce8b589d43d2c64f330945b54589709d3c2eea58bbc9477df07cd7ca6b24",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-troll_1794028064801_2dca5e8b.png",
      "sheetSha256": "7e391c64ddc379b8b0e756c72d273d462fd816a40c85b33809f8a7e5e7f0b993",
      "sheet": "sheets/troll.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-troll-diagonals.png",
      "diagonalSheetSha256": "78fca5ed4e8ad2ad621b724c0a0d56cca453c467db66c214c0a88885d1222666",
      "atlas": "atlases/troll.png",
      "sourceBounds": [
        [
          43,
          35,
          213,
          224
        ],
        [
          58,
          33,
          199,
          224
        ],
        [
          54,
          33,
          203,
          224
        ],
        [
          50,
          32,
          207,
          224
        ],
        [
          46,
          32,
          210,
          224
        ],
        [
          53,
          32,
          203,
          224
        ],
        [
          54,
          33,
          203,
          224
        ],
        [
          56,
          30,
          200,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "minotaur",
      "name": "Minotaur",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/minotaur/minotaur/reference.png",
      "sourceSha256": "9f8adb14fb09bb8384f9597f8db02a84df05725105db5705eeed6defa9b53317",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-minotaur_1794028092204_1cfdf09b.png",
      "sheetSha256": "6083f5e6c78ddeac84e6abb5cec95a21845143349356818e718afd7ffeecfa70",
      "sheet": "sheets/minotaur.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-minotaur-diagonals.png",
      "diagonalSheetSha256": "af9c20203f4bae8b45d0e50a6d34ec722567a9334acd2cdf937da5576e2ea9e6",
      "atlas": "atlases/minotaur.png",
      "sourceBounds": [
        [
          53,
          35,
          204,
          224
        ],
        [
          66,
          35,
          190,
          224
        ],
        [
          62,
          32,
          195,
          224
        ],
        [
          68,
          37,
          188,
          224
        ],
        [
          52,
          36,
          204,
          224
        ],
        [
          66,
          29,
          191,
          224
        ],
        [
          61,
          32,
          196,
          224
        ],
        [
          65,
          28,
          192,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "skeleton",
      "name": "Skeleton",
      "race": "undead",
      "source": "archive/art-reference/monsters/undead/skeleton/skeleton/animation/poses/idle/south.png",
      "sourceSha256": "176bb7623eb397b3683dc62341fdf435bff2f38be523c22bc69429ef7e271a5c",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-skeleton_1794028179444_86cd518a.png",
      "sheetSha256": "9ff17b24621ec287ad47e2781e79116b847b2e870392a06092e5f644d54014bc",
      "sheet": "sheets/skeleton.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-skeleton-diagonals.png",
      "diagonalSheetSha256": "535628c6eabe218e09da97d078359794faca83db9099bf077fb2dad8a01ca02c",
      "atlas": "atlases/skeleton.png",
      "sourceBounds": [
        [
          77,
          32,
          180,
          224
        ],
        [
          75,
          31,
          182,
          224
        ],
        [
          76,
          35,
          180,
          224
        ],
        [
          75,
          32,
          181,
          224
        ],
        [
          77,
          33,
          179,
          224
        ],
        [
          76,
          33,
          181,
          224
        ],
        [
          76,
          36,
          180,
          224
        ],
        [
          75,
          32,
          182,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "mummy",
      "name": "Mummy",
      "race": "undead",
      "source": "archive/art-reference/monsters/undead/mummy/mummy/reference.png",
      "sourceSha256": "d3c4a4ecedb8a6ac7f6640f61643e98df7ee729a1cf1ecce60dbcce20ddae3c2",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-mummy-refined_1794029441000_ceb6d007.png",
      "sheetSha256": "c5edb01c8eee4d97eddf2d5a363f7144645c2c48631cc2ca31365cdfc2de4773",
      "sheet": "sheets/mummy.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-mummy-diagonals.png",
      "diagonalSheetSha256": "6cc380a4cbc227bba88d6c2ee3cda6fbe543dccce8933e723e8b219f41ceb5a4",
      "atlas": "atlases/mummy.png",
      "sourceBounds": [
        [
          75,
          32,
          182,
          224
        ],
        [
          75,
          32,
          182,
          224
        ],
        [
          76,
          37,
          180,
          224
        ],
        [
          74,
          32,
          182,
          224
        ],
        [
          76,
          32,
          181,
          224
        ],
        [
          74,
          32,
          182,
          224
        ],
        [
          76,
          37,
          180,
          224
        ],
        [
          75,
          32,
          182,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "vampire",
      "name": "Vampire",
      "race": "undead",
      "source": "archive/art-reference/monsters/undead/vampire/vampire/reference.png",
      "sourceSha256": "ec69cc3e4f8ff1f87bcf0fb032b85498b0b7d0a89f1841449cbff79e949a0a3f",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-vampire_1794028238843_a8d61dca.png",
      "sheetSha256": "13ce6dd72c398fe24cf009ecd73a6a3031c6a68cc114103d3b9c3e26b905a2cf",
      "sheet": "sheets/vampire.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-vampire-diagonals.png",
      "diagonalSheetSha256": "2001da4416e6a671da2b8a77626d6a4142a64b44664bd5b4745df755a0abcb06",
      "atlas": "atlases/vampire.png",
      "sourceBounds": [
        [
          65,
          45,
          192,
          224
        ],
        [
          67,
          32,
          189,
          224
        ],
        [
          75,
          32,
          181,
          224
        ],
        [
          68,
          32,
          188,
          224
        ],
        [
          68,
          38,
          189,
          224
        ],
        [
          69,
          32,
          188,
          224
        ],
        [
          76,
          32,
          181,
          224
        ],
        [
          67,
          32,
          189,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "demon",
      "name": "Demon",
      "race": "demon",
      "source": "archive/art-reference/monsters/demon/demon/demon/reference.png",
      "sourceSha256": "75333a43ccc0bec99ff128e9de32e62e9cca39a28937706537147dd4cab25b9e",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-demon-refined_1794029469603_1a272973.png",
      "sheetSha256": "c36e6cfe21d6109e47c3e9c6552d7988af8209f462efe077ca85b65e3b9e0ef6",
      "sheet": "sheets/demon.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-demon-diagonals.png",
      "diagonalSheetSha256": "4c263eb7a344410930cec25fd220a1ec895fbddfceb91eb2fde44d8e34c5d7a4",
      "atlas": "atlases/demon.png",
      "sourceBounds": [
        [
          64,
          40,
          192,
          224
        ],
        [
          82,
          32,
          175,
          224
        ],
        [
          81,
          32,
          175,
          224
        ],
        [
          84,
          32,
          172,
          224
        ],
        [
          63,
          45,
          193,
          224
        ],
        [
          85,
          32,
          172,
          224
        ],
        [
          82,
          33,
          175,
          224
        ],
        [
          81,
          32,
          175,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime",
      "name": "Slime",
      "race": "formless",
      "source": "archive/art-reference/monsters/formless/slime/slime/reference.png",
      "sourceSha256": "3f62d527ee54cb2800045d1c022b4f743c8dd5efbb182428a3a7774a4b20e545",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-slime_1794028288296_e8da0489.png",
      "sheetSha256": "f1fe71b8692dd193e81d493085ffb7c5ead58754fa6751e5a87669d45aecc9bd",
      "sheet": "sheets/slime.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime-diagonals.png",
      "diagonalSheetSha256": "b65f8f3e9645254d9121dca1cd37f434db2c1660250293c13648907eb5a376f5",
      "atlas": "atlases/slime.png",
      "sourceBounds": [
        [
          29,
          61,
          228,
          224
        ],
        [
          25,
          61,
          231,
          224
        ],
        [
          29,
          63,
          228,
          224
        ],
        [
          26,
          61,
          230,
          224
        ],
        [
          29,
          61,
          228,
          224
        ],
        [
          26,
          61,
          231,
          224
        ],
        [
          28,
          63,
          228,
          224
        ],
        [
          25,
          61,
          231,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider",
      "name": "Spider",
      "race": "insect",
      "source": "archive/art-reference/monsters/insect/spider/spider/animation/poses/idle/south.png",
      "sourceSha256": "59c34f1acc92ab4d9b00d0188297416bb849213e3fe38bc09ac018ba9e053b85",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-spider_1794028319578_b89c01b8.png",
      "sheetSha256": "296816a1040933c05cd9d89524a92bfaee18308d5b93f65c752e6381b10062d1",
      "sheet": "sheets/spider.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider-diagonals.png",
      "diagonalSheetSha256": "f24313f9f81251616c8ebf173d5d715dc89a106a6a8f7f163e71f1982c0049cc",
      "atlas": "atlases/spider.png",
      "sourceBounds": [
        [
          28,
          108,
          228,
          224
        ],
        [
          43,
          105,
          213,
          224
        ],
        [
          37,
          110,
          219,
          224
        ],
        [
          43,
          111,
          213,
          224
        ],
        [
          29,
          113,
          228,
          224
        ],
        [
          44,
          112,
          213,
          224
        ],
        [
          37,
          111,
          220,
          224
        ],
        [
          43,
          105,
          213,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wolf",
      "name": "Wolf",
      "race": "beast",
      "source": "archive/art-reference/monsters/beast/wolf/wolf/animation/poses/idle/south.png",
      "sourceSha256": "c319bdb9706a56a1bc13ef8ad79623ec1cb51d407694b4c977cfcb4092eb4f0d",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-wolf_1794028400326_1aed1286.png",
      "sheetSha256": "a265f5f77f8ef92d15c354d0d2569f777bb417f63b1dee7c5ba4d4fafe756785",
      "sheet": "sheets/wolf.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wolf-diagonals.png",
      "diagonalSheetSha256": "ccb72316cabdbff98316e8cfda105f6323225dc55803c3851c74f555949ae36f",
      "atlas": "atlases/wolf.png",
      "sourceBounds": [
        [
          88,
          82,
          168,
          224
        ],
        [
          57,
          72,
          200,
          224
        ],
        [
          29,
          90,
          227,
          224
        ],
        [
          67,
          62,
          189,
          224
        ],
        [
          91,
          67,
          166,
          224
        ],
        [
          69,
          61,
          188,
          224
        ],
        [
          28,
          90,
          228,
          224
        ],
        [
          60,
          72,
          197,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem",
      "name": "Golem",
      "race": "elemental",
      "source": "archive/art-reference/monsters/elemental/golem/golem/animation/poses/idle/south.png",
      "sourceSha256": "da452408fe12b06285952780fb82d73d0ed9cc17756b49b9638ee7237524f2aa",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-golem-v2-craggy_1794049456810_70074a46.png",
      "sheetSha256": "61ffd5b58011607ce086313c0e56e9c2c1a6def593a99f611104905248ba1078",
      "sheet": "sheets/golem.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem-diagonals.png",
      "diagonalSheetSha256": "a6080c8f4b06fc5501568b0af7871e3d906176a3352470313ccbc6822dde7804",
      "atlas": "atlases/golem.png",
      "sourceBounds": [
        [
          45,
          36,
          212,
          224
        ],
        [
          62,
          33,
          195,
          224
        ],
        [
          67,
          32,
          190,
          224
        ],
        [
          61,
          33,
          196,
          224
        ],
        [
          47,
          36,
          209,
          224
        ],
        [
          62,
          31,
          195,
          224
        ],
        [
          66,
          32,
          191,
          224
        ],
        [
          62,
          31,
          195,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "dragon",
      "name": "Dragon",
      "race": "dragon",
      "source": "archive/art-reference/monsters/dragon/dragon/dragon/reference.png",
      "sourceSha256": "ccfeed747c5302c56c0db26adf4efee10240f23206304f05a7c6ce858f75d1ae",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-dragon_1794028457265_8934b046.png",
      "sheetSha256": "95a5ab431352df68f372c0f7b889b1edf3f33b8dbe7454cd04ddf406c5843282",
      "sheet": "sheets/dragon.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-dragon-diagonals.png",
      "diagonalSheetSha256": "53978a5efdc761758d79632bbb2f21fcc9f7dbb0ed41d5ab8a456124c4d25aef",
      "atlas": "atlases/dragon.png",
      "sourceBounds": [
        [
          69,
          69,
          188,
          224
        ],
        [
          40,
          68,
          216,
          224
        ],
        [
          31,
          69,
          225,
          224
        ],
        [
          46,
          67,
          211,
          224
        ],
        [
          68,
          76,
          189,
          224
        ],
        [
          46,
          67,
          211,
          224
        ],
        [
          28,
          67,
          228,
          224
        ],
        [
          41,
          67,
          216,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "treant",
      "name": "Treant",
      "race": "plant",
      "source": "archive/art-reference/monsters/plant/treant/treant/reference.png",
      "sourceSha256": "a6d773e94f7a77a376de685b408fcc184510bbd2641af137f51057e6ce7e6180",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-treant_1794028493246_2f31d4ca.png",
      "sheetSha256": "aa997fe75f1df2c29dced9e8bb7dfe1d93ebc9f91a1cca2c4dbe759275963218",
      "sheet": "sheets/treant.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-treant-diagonals.png",
      "diagonalSheetSha256": "c0fc2fffddab888cecdcfcfbb90d43025bd3e19c0c707c59f4e63eada5fe093e",
      "atlas": "atlases/treant.png",
      "sourceBounds": [
        [
          50,
          48,
          207,
          224
        ],
        [
          49,
          32,
          208,
          224
        ],
        [
          72,
          33,
          185,
          224
        ],
        [
          50,
          32,
          207,
          224
        ],
        [
          47,
          48,
          209,
          224
        ],
        [
          53,
          30,
          203,
          224
        ],
        [
          71,
          32,
          185,
          224
        ],
        [
          53,
          34,
          203,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "human",
      "name": "Human",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/human/human/reference.png",
      "sourceSha256": "03a7664e7d89041bdb9ab58c7e7f866930e37ed74de14c1d2b29d40e8039f6f9",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-human_1794028512077_a27d7ce6.png",
      "sheetSha256": "f904d6ef13963407ba12d1f6074f951a700eb6e11b653476aee113b8a5e71bd2",
      "sheet": "sheets/human.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-human-diagonals.png",
      "diagonalSheetSha256": "90b766fe25fe84d75e4e90c19b830ba5915d60ec4d09e9eb8cabb9e1be68b0a8",
      "atlas": "atlases/human.png",
      "sourceBounds": [
        [
          68,
          34,
          189,
          224
        ],
        [
          68,
          32,
          188,
          224
        ],
        [
          68,
          33,
          189,
          224
        ],
        [
          68,
          32,
          188,
          224
        ],
        [
          68,
          34,
          188,
          224
        ],
        [
          68,
          32,
          189,
          224
        ],
        [
          67,
          32,
          190,
          224
        ],
        [
          68,
          32,
          189,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "lizardman",
      "name": "Lizardman",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/lizardman/lizardman/reference.png",
      "sourceSha256": "700fdcb9d93131057577a099230e6ed3dc939b66494cb659be22facd296916f4",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-lizardman_1794028540455_ba0ff74d.png",
      "sheetSha256": "1e914a466cc8a903d71d6451a647b721b4a73191a1e594496c2a232e2197534a",
      "sheet": "sheets/lizardman.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-lizardman-diagonals.png",
      "diagonalSheetSha256": "b51b0ee9b63de20c038afc357a79bd28085fb3fec07f171716fbbf3acb3c51e2",
      "atlas": "atlases/lizardman.png",
      "sourceBounds": [
        [
          91,
          121,
          166,
          224
        ],
        [
          91,
          113,
          165,
          224
        ],
        [
          75,
          113,
          181,
          224
        ],
        [
          93,
          114,
          163,
          224
        ],
        [
          90,
          120,
          166,
          224
        ],
        [
          94,
          113,
          163,
          224
        ],
        [
          74,
          113,
          182,
          224
        ],
        [
          90,
          113,
          166,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "elf",
      "name": "Elf",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/elf/elf/reference.png",
      "sourceSha256": "2c922138374a8b54bed145c9dc5fd7c831638bfef5cd00676bdc67a878bf24e2",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-elf-v2-tail-less_1794049393183_7f67fac0.png",
      "sheetSha256": "bf75f8390fe4978ebffbbeae97d201a3c22154aacf2365bc37554c0c05d6454a",
      "sheet": "sheets/elf.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-elf-diagonals.png",
      "diagonalSheetSha256": "b42cd509d1b7b7cbd0b82a38785776268b3c8e5cd9e06f2a97532f6c0ca0a18c",
      "atlas": "atlases/elf.png",
      "sourceBounds": [
        [
          66,
          68,
          191,
          224
        ],
        [
          75,
          68,
          182,
          224
        ],
        [
          85,
          76,
          172,
          224
        ],
        [
          81,
          68,
          175,
          224
        ],
        [
          69,
          68,
          188,
          224
        ],
        [
          81,
          68,
          176,
          224
        ],
        [
          85,
          75,
          172,
          224
        ],
        [
          76,
          68,
          181,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "giant",
      "name": "Giant",
      "race": "humanoid",
      "source": "archive/art-reference/monsters/humanoid/giant/giant/reference.png",
      "sourceSha256": "531e79921e865be53b4dad712117152e1acb2ebc2654007cd39e732aa88920c7",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-giant_1794028647458_8652fcff.png",
      "sheetSha256": "5c8ae7a3f17570e6ce88d648d49e3b53d95e54440962ca15e4a83cf0e5b4060e",
      "sheet": "sheets/giant.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-giant-diagonals.png",
      "diagonalSheetSha256": "77a82c9dca67917d48865c8da49218ffe8907a5ac87f9899fbedc9be8ca19c95",
      "atlas": "atlases/giant.png",
      "sourceBounds": [
        [
          77,
          41,
          180,
          224
        ],
        [
          67,
          31,
          190,
          224
        ],
        [
          77,
          32,
          179,
          224
        ],
        [
          70,
          32,
          186,
          224
        ],
        [
          77,
          42,
          180,
          224
        ],
        [
          70,
          32,
          186,
          224
        ],
        [
          77,
          32,
          179,
          224
        ],
        [
          67,
          32,
          190,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "werewolf",
      "name": "Werewolf",
      "race": "beast",
      "source": "archive/art-reference/monsters/beast/werewolf/werewolf/reference.png",
      "sourceSha256": "9bb0523dad13d8d23006ce987d61ce615c0bd7cbd00a80e40bf92bc01d2f531f",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-werewolf_1794028676178_19630d1f.png",
      "sheetSha256": "00b9d6b6912fc8142a2c5648992a8fff37cac5486df3febb410fc0c1c4fec2ad",
      "sheet": "sheets/werewolf.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-werewolf-diagonals.png",
      "diagonalSheetSha256": "697d85904fe67ffd81cb0485319bef77f3cd713d29e50eca171d7b6594ead51f",
      "atlas": "atlases/werewolf.png",
      "sourceBounds": [
        [
          70,
          83,
          187,
          224
        ],
        [
          63,
          83,
          193,
          224
        ],
        [
          28,
          81,
          228,
          224
        ],
        [
          67,
          80,
          189,
          224
        ],
        [
          78,
          83,
          178,
          224
        ],
        [
          68,
          80,
          189,
          224
        ],
        [
          29,
          82,
          228,
          224
        ],
        [
          63,
          82,
          193,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "dryad",
      "name": "Dryad",
      "race": "plant",
      "source": "archive/art-reference/monsters/plant/dryad/dryad/animation/poses/idle/south.png",
      "sourceSha256": "a33ddb94e7a5634f5bcd82884c87a54ccbd740bdd81a5f6ade9597c4660a5f1a",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-dryad_1794028700570_50ab40d8.png",
      "sheetSha256": "9c755190f5582e565cda8cf161f9c34bdcf483944c4cee08fc5024d2703dd76c",
      "sheet": "sheets/dryad.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-dryad-diagonals.png",
      "diagonalSheetSha256": "09ae4302a4a33444626d30c1be11b64e6e9844085379eccba0fd83cf7410a6cf",
      "atlas": "atlases/dryad.png",
      "sourceBounds": [
        [
          72,
          32,
          184,
          224
        ],
        [
          82,
          33,
          174,
          224
        ],
        [
          80,
          38,
          176,
          224
        ],
        [
          83,
          31,
          174,
          224
        ],
        [
          76,
          33,
          181,
          224
        ],
        [
          83,
          32,
          173,
          224
        ],
        [
          80,
          37,
          176,
          224
        ],
        [
          83,
          32,
          174,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "siren",
      "name": "Siren",
      "race": "fish",
      "source": "archive/art-reference/monsters/fish/siren/siren/reference.png",
      "sourceSha256": "01a2e879f553761f3212187f26923513c7d93e7d7fb25e5485474109a771f860",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-siren_1794028725223_0a431742.png",
      "sheetSha256": "59160b70bdd85dfe16ba8095910ba828f77c723c21704d617948ce1671d76c49",
      "sheet": "sheets/siren.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-siren-diagonals.png",
      "diagonalSheetSha256": "3f1f533f7acc95a4f558e97f86b369c26ca713ca0aeb8a7c01ab5382a00dace7",
      "atlas": "atlases/siren.png",
      "sourceBounds": [
        [
          83,
          93,
          174,
          224
        ],
        [
          91,
          86,
          165,
          224
        ],
        [
          92,
          102,
          165,
          224
        ],
        [
          93,
          87,
          163,
          224
        ],
        [
          84,
          88,
          172,
          224
        ],
        [
          92,
          89,
          165,
          224
        ],
        [
          92,
          102,
          165,
          224
        ],
        [
          91,
          90,
          166,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wraith",
      "name": "Wraith",
      "race": "undead",
      "source": "archive/art-reference/monsters/undead/wraith/wraith/reference.png",
      "sourceSha256": "1de8d8790d09ca7a9f96a1a9c71eb64a968ebd36e3056b1bb0fdc733e76c3829",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-wraith_1794028751702_5eccde6c.png",
      "sheetSha256": "524dfb1df4505fd9f4c42888807346d7d4d9297aafe2f8b735965057dd8a4712",
      "shadowCutoffByView": [
        438,
        438,
        420,
        420
      ],
      "sheet": "sheets/wraith.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wraith-diagonals.png",
      "diagonalSheetSha256": "35c912eec57d00a4608e91ecb6603969d88259a30df5342a1cb1725e9503cecd",
      "atlas": "atlases/wraith.png",
      "sourceBounds": [
        [
          86,
          75,
          171,
          224
        ],
        [
          90,
          66,
          167,
          224
        ],
        [
          93,
          67,
          164,
          224
        ],
        [
          91,
          66,
          166,
          224
        ],
        [
          87,
          74,
          170,
          224
        ],
        [
          90,
          68,
          166,
          224
        ],
        [
          92,
          67,
          164,
          224
        ],
        [
          92,
          68,
          164,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "imp",
      "name": "Imp",
      "race": "demon",
      "source": "archive/art-reference/monsters/demon/imp/imp/reference.png",
      "sourceSha256": "43d84814e1ce1cdc090ff318dcbb0b12c9dd9615ca74e53add725ffb336a6d2f",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-imp_1794028818271_35b5b3ed.png",
      "sheetSha256": "a80b3901a74a2793a9fb75dc4c2421ae8a0bd7802c20ef1f9b52e51ffb84d1dd",
      "sheet": "sheets/imp.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-imp-diagonals.png",
      "diagonalSheetSha256": "967a5223e9498f842baf5e9c56532d51a55e38e1fc8a73abd06d8e18c96883f1",
      "atlas": "atlases/imp.png",
      "sourceBounds": [
        [
          44,
          70,
          212,
          224
        ],
        [
          61,
          49,
          195,
          224
        ],
        [
          68,
          61,
          188,
          224
        ],
        [
          58,
          45,
          198,
          224
        ],
        [
          46,
          47,
          210,
          224
        ],
        [
          58,
          45,
          198,
          224
        ],
        [
          68,
          61,
          188,
          224
        ],
        [
          61,
          49,
          196,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wyvern",
      "name": "Wyvern",
      "race": "dragon",
      "source": "archive/art-reference/monsters/dragon/wyvern/wyvern/reference.png",
      "sourceSha256": "a522830935c0c4222a74c451e6fab981862772fe56d37c2e058f79d5eff6f994",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-wyvern-refined_1794029725841_010c6984.png",
      "sheetSha256": "96fbcf61d26a679b75c17b19059d960d78429fcd28a904388fe874cf68f674eb",
      "sheet": "sheets/wyvern.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wyvern-diagonals.png",
      "diagonalSheetSha256": "bdf2b9c4a92744bdc98599c5e5ec9bcc5f724af910017ef03c943ad7989f450d",
      "atlas": "atlases/wyvern.png",
      "sourceBounds": [
        [
          62,
          91,
          195,
          224
        ],
        [
          68,
          87,
          189,
          224
        ],
        [
          34,
          90,
          223,
          224
        ],
        [
          78,
          83,
          178,
          224
        ],
        [
          64,
          86,
          192,
          224
        ],
        [
          78,
          77,
          178,
          224
        ],
        [
          36,
          84,
          221,
          224
        ],
        [
          68,
          85,
          189,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "beetle",
      "name": "Beetle",
      "race": "insect",
      "source": "archive/art-reference/monsters/insect/beetle/beetle/reference.png",
      "sourceSha256": "f20afcf5899f3d54a35a6fa8f89e206f0d915198221f06b2eacc9e1d7f19231b",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-beetle_1794028858153_08750e6b.png",
      "sheetSha256": "b0db5a1660b96f294f157c8d6320c7563de9a24bbbd110f93410c837577dd561",
      "sheet": "sheets/beetle.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-beetle-diagonals.png",
      "diagonalSheetSha256": "5da2c80870463b0b1312e8fd8ea77a2920b41f07431a9e43d46a2b79d1789c7a",
      "atlas": "atlases/beetle.png",
      "sourceBounds": [
        [
          28,
          77,
          228,
          224
        ],
        [
          21,
          81,
          235,
          224
        ],
        [
          31,
          118,
          226,
          224
        ],
        [
          28,
          73,
          229,
          224
        ],
        [
          31,
          91,
          225,
          224
        ],
        [
          28,
          73,
          229,
          224
        ],
        [
          30,
          118,
          227,
          224
        ],
        [
          21,
          83,
          235,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "hornet",
      "name": "Hornet",
      "race": "insect",
      "source": "archive/art-reference/monsters/insect/hornet/hornet/reference.png",
      "sourceSha256": "417f4865181a4911cecc3c1924cd20d5f5422e914fc8e6b6f7c48d43a0cf16c3",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-hornet_1794029263256_02e710ee.png",
      "sheetSha256": "18c6211a3c80a21d367cca8c640666b3a5929b34f2f2b81009b4e89adaa601e4",
      "sheet": "sheets/hornet.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-hornet-diagonals.png",
      "diagonalSheetSha256": "5948403239b037293afe30906b571e11e542a13fae7babd9264e1de3b640cbd0",
      "atlas": "atlases/hornet.png",
      "sourceBounds": [
        [
          28,
          72,
          228,
          224
        ],
        [
          49,
          67,
          207,
          224
        ],
        [
          31,
          68,
          226,
          224
        ],
        [
          52,
          72,
          205,
          224
        ],
        [
          32,
          76,
          224,
          224
        ],
        [
          51,
          69,
          205,
          224
        ],
        [
          33,
          68,
          223,
          224
        ],
        [
          50,
          64,
          207,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ooze",
      "name": "Ooze",
      "race": "formless",
      "source": "archive/art-reference/monsters/formless/ooze/ooze/reference.png",
      "sourceSha256": "cd9581ea60d71982cfe4e41e2d529e01c871e39edbfe8e9ec3a3055bfceb8f24",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-ooze_1794028914052_af5e7e03.png",
      "sheetSha256": "7600ffd15a98b0cb09beacf9232e4bead61a5de6ca7bbe6781ec253568ef7f0f",
      "sheet": "sheets/ooze.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ooze-diagonals.png",
      "diagonalSheetSha256": "6488a651bcbc859bbd07c6f54877b4ada47252bcc7b4b80d9419868bebab3d5a",
      "atlas": "atlases/ooze.png",
      "sourceBounds": [
        [
          61,
          93,
          196,
          224
        ],
        [
          63,
          87,
          194,
          224
        ],
        [
          67,
          86,
          190,
          224
        ],
        [
          63,
          87,
          194,
          224
        ],
        [
          62,
          92,
          195,
          224
        ],
        [
          61,
          85,
          196,
          224
        ],
        [
          65,
          86,
          191,
          224
        ],
        [
          62,
          85,
          194,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wisp",
      "name": "Wisp",
      "race": "elemental",
      "source": "archive/art-reference/monsters/elemental/wisp/wisp/animation/poses/idle/south.png",
      "sourceSha256": "c7eaac52eb38564121842ef5f836d580e6640c2f6c98372e0b78763651b015ca",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-wisp_1794028950641_1ac5062a.png",
      "sheetSha256": "696f3bf48c467961305ecee707a573f5a5d128b7c3f0732d6c973066c92ef428",
      "sheet": "sheets/wisp.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wisp-diagonals.png",
      "diagonalSheetSha256": "3404fe04e45eb952deea8f8bc2a6f6b6f44906644db39c29dad16043f2aa6d68",
      "atlas": "atlases/wisp.png",
      "sourceBounds": [
        [
          40,
          32,
          217,
          224
        ],
        [
          50,
          32,
          206,
          224
        ],
        [
          54,
          46,
          202,
          224
        ],
        [
          53,
          33,
          204,
          224
        ],
        [
          42,
          32,
          214,
          224
        ],
        [
          52,
          36,
          205,
          224
        ],
        [
          54,
          46,
          202,
          224
        ],
        [
          52,
          34,
          204,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "harpy",
      "name": "Harpy",
      "race": "beast",
      "source": "archive/art-reference/monsters/beast/harpy/harpy/reference.png",
      "sourceSha256": "6284ad99c0b79d9d3572c638d15989bc8cb5d3428adc34f03a8c50bf65842354",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-harpy-refined_1794029489333_e2543db2.png",
      "sheetSha256": "1e1262bcd1719b52cab67b264038b5fec3e15224688348b0b5e6c2d566ec7807",
      "sheet": "sheets/harpy.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-harpy-diagonals.png",
      "diagonalSheetSha256": "064787a03ec4c70ec6f66fb1dad20d0eed83f1120accd4f69a43a70ac0d9f018",
      "atlas": "atlases/harpy.png",
      "sourceBounds": [
        [
          76,
          33,
          180,
          224
        ],
        [
          77,
          34,
          179,
          224
        ],
        [
          72,
          39,
          185,
          224
        ],
        [
          81,
          32,
          175,
          224
        ],
        [
          77,
          32,
          180,
          224
        ],
        [
          80,
          34,
          176,
          224
        ],
        [
          72,
          39,
          185,
          224
        ],
        [
          75,
          36,
          181,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "bonehound",
      "name": "Bone Hound",
      "race": "undead",
      "source": "archive/art-reference/monsters/undead/bonehound/bonehound/reference.png",
      "sourceSha256": "ee17567b298e7a5956e8017d0bdb53a459fba87fd56206a94194f609493cf302",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-bonehound_1794029064716_d9bc0798.png",
      "sheetSha256": "ae6cf53dd7c3dbf5b2560940b0590df73d8f98d62ccbc57dfc7ae1c541a62633",
      "sheet": "sheets/bonehound.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-bonehound-diagonals.png",
      "diagonalSheetSha256": "bff9eb4804e3e95655069ba8ca21eb39ea95fdaff14bd05fa1792c43304204ea",
      "atlas": "atlases/bonehound.png",
      "sourceBounds": [
        [
          180,
          118,
          332,
          399
        ],
        [
          105,
          231,
          516,
          481
        ],
        [
          32,
          125,
          475,
          332
        ],
        [
          151,
          198,
          473,
          482
        ],
        [
          177,
          123,
          332,
          400
        ],
        [
          155,
          185,
          475,
          472
        ],
        [
          36,
          125,
          472,
          332
        ],
        [
          113,
          220,
          520,
          470
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "revenant",
      "name": "Frost Revenant",
      "race": "undead",
      "source": "archive/art-reference/monsters/undead/revenant/revenant/reference.png",
      "sourceSha256": "9ceb698ced7ede93800f82959f03c64f4a00d5e73462c29b0ad775d6ab42dea8",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-revenant_1794029086442_eb9af625.png",
      "sheetSha256": "6d9d69639b8b2f4228f14913eea14573a6f89b063635c70b62c6c51051326eac",
      "sheet": "sheets/revenant.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-revenant-diagonals.png",
      "diagonalSheetSha256": "5b5a7d111086fa14d55186f27a4121cc722c9ec50e5db606e3c34f5ec7683f2a",
      "atlas": "atlases/revenant.png",
      "sourceBounds": [
        [
          143,
          55,
          380,
          435
        ],
        [
          190,
          104,
          404,
          493
        ],
        [
          134,
          31,
          326,
          403
        ],
        [
          214,
          104,
          417,
          494
        ],
        [
          132,
          53,
          364,
          447
        ],
        [
          210,
          104,
          431,
          511
        ],
        [
          176,
          30,
          369,
          404
        ],
        [
          224,
          104,
          444,
          507
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "mirehydra",
      "name": "Mire Hydra",
      "race": "dragon",
      "source": "archive/art-reference/monsters/dragon/mirehydra/mirehydra/reference.png",
      "sourceSha256": "8d40fce6ecc7e83b668b4b6d41cf99abdf02030e271f276ee488ebc734305ec1",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-mirehydra_1794029300032_ac593074.png",
      "sheetSha256": "085c31b4ec04b72a8f5608deb5a77342ebac92c539c1d4c24a336bc7ecc6ae31",
      "sheet": "sheets/mirehydra.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-mirehydra-diagonals.png",
      "diagonalSheetSha256": "e6cfe6d94c73532c22b3a32b477a2c7623de8763cd6dd799e0d1edea52f06c8b",
      "atlas": "atlases/mirehydra.png",
      "sourceBounds": [
        [
          88,
          78,
          451,
          426
        ],
        [
          82,
          96,
          506,
          520
        ],
        [
          48,
          36,
          431,
          375
        ],
        [
          140,
          91,
          502,
          538
        ],
        [
          99,
          74,
          396,
          486
        ],
        [
          102,
          43,
          469,
          482
        ],
        [
          80,
          33,
          456,
          373
        ],
        [
          96,
          35,
          526,
          469
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slaggolem",
      "name": "Slag Golem",
      "race": "elemental",
      "source": "archive/art-reference/monsters/elemental/slaggolem/slaggolem/reference.png",
      "sourceSha256": "d915da510d7a2d9d63c3d4cd3d11198a5eb1b8d7322eb5d9979cbe1a2fbc9ebd",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-slaggolem-refined_1794029763914_96560748.png",
      "sheetSha256": "aa42a06d12bd21d6f44e21095168571015e033bbd41a9a50653520cff87eef04",
      "sheet": "sheets/slaggolem.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slaggolem-diagonals.png",
      "diagonalSheetSha256": "eab1c43ea000d350e78a4921b42a68895ab11343d8092e61a404e847cf06fa7c",
      "atlas": "atlases/slaggolem.png",
      "sourceBounds": [
        [
          138,
          54,
          379,
          417
        ],
        [
          191,
          117,
          388,
          476
        ],
        [
          145,
          38,
          362,
          422
        ],
        [
          215,
          117,
          429,
          478
        ],
        [
          131,
          53,
          369,
          417
        ],
        [
          191,
          111,
          407,
          475
        ],
        [
          139,
          38,
          356,
          422
        ],
        [
          222,
          108,
          433,
          475
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wyrmling",
      "name": "Wyrmling",
      "race": "dragon",
      "source": "archive/art-reference/monsters/dragon/wyrmling/wyrmling/reference.png",
      "sourceSha256": "06a19d7c34be55759b29f9905aab133feeb464f5396714cf14087c5dd20a4228",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-wyrmling_1794029202772_d87b4d38.png",
      "sheetSha256": "70a8bd1d7a81bb340e74c779efb74aadc270fbf0ed3a9cd0df0893f625e95e2a",
      "sheet": "sheets/wyrmling.png",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wyrmling-diagonals.png",
      "diagonalSheetSha256": "45ae37b4d6e390c4a10d6f2c811cd27cac1f60c3cbd959daad249d76760c9e3e",
      "atlas": "atlases/wyrmling.png",
      "sourceBounds": [
        [
          135,
          90,
          389,
          405
        ],
        [
          158,
          160,
          433,
          462
        ],
        [
          60,
          76,
          419,
          382
        ],
        [
          185,
          145,
          461,
          470
        ],
        [
          129,
          94,
          365,
          409
        ],
        [
          165,
          122,
          447,
          452
        ],
        [
          92,
          73,
          447,
          382
        ],
        [
          197,
          135,
          472,
          443
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    }
  ],
  "variants": [
    {
      "id": "goblin--sneak-goblin",
      "name": "Sneak Goblin",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "goblin",
      "identitySource": "archive/art-reference/monsters/humanoid/goblin/sneak-goblin/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-goblin-sneak-goblin.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-goblin-sneak-goblin_1794030717434_984fe65d.png",
      "sheet": "sheets/variants/goblin--sneak-goblin.png",
      "sheetSha256": "c431262723d24ed0ebc9f6d4658aed3dcbc85ff5c23facdfc5ff59106f833550",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-goblin--sneak-goblin-diagonals.png",
      "diagonalSheetSha256": "c54dfb8ec1551fefc1ed5c2418021e8e9987531bd5fc869f46806c029a56f0bb",
      "atlas": "atlases/variants/goblin--sneak-goblin.png",
      "sourceBounds": [
        [
          58,
          82,
          199,
          224
        ],
        [
          76,
          82,
          181,
          224
        ],
        [
          87,
          82,
          169,
          224
        ],
        [
          77,
          82,
          179,
          224
        ],
        [
          58,
          82,
          198,
          224
        ],
        [
          77,
          82,
          180,
          224
        ],
        [
          87,
          82,
          170,
          224
        ],
        [
          77,
          82,
          179,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "goblin--tallow-goblin",
      "name": "Tallow Goblin",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "goblin",
      "identitySource": "archive/art-reference/monsters/humanoid/goblin/tallow-goblin/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-goblin-tallow-goblin.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-goblin-tallow-goblin_1794030804792_6b5d1fde.png",
      "sheet": "sheets/variants/goblin--tallow-goblin.png",
      "sheetSha256": "8f2e9413bd7c3c740e0cc30aba947e350600fe502a400b045eb6742dc79a4dac",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-goblin--tallow-goblin-diagonals.png",
      "diagonalSheetSha256": "d1cad99719a93d0dfa8d39476586f3b4d62c6e9cf46ef56c9139ee27cabbde60",
      "atlas": "atlases/variants/goblin--tallow-goblin.png",
      "sourceBounds": [
        [
          53,
          95,
          203,
          224
        ],
        [
          92,
          94,
          165,
          224
        ],
        [
          91,
          100,
          166,
          224
        ],
        [
          93,
          95,
          163,
          224
        ],
        [
          54,
          96,
          203,
          224
        ],
        [
          92,
          95,
          164,
          224
        ],
        [
          91,
          100,
          166,
          224
        ],
        [
          93,
          95,
          164,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "goblin--warcaller-goblin",
      "name": "Warcaller Goblin",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "goblin",
      "identitySource": "archive/art-reference/monsters/humanoid/goblin/warcaller-goblin/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-goblin-warcaller-goblin.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-goblin-warcaller-goblin_1794030765571_67880953.png",
      "sheet": "sheets/variants/goblin--warcaller-goblin.png",
      "sheetSha256": "aaed557c6d076940eadf5462d07121107070a18c571d5f60dea3b26b8a9c12fc",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-goblin--warcaller-goblin-diagonals.png",
      "diagonalSheetSha256": "a075d1f3f1624fab042d93e1a72dff926548e92912a282219c02aaf005ab8bb1",
      "atlas": "atlases/variants/goblin--warcaller-goblin.png",
      "sourceBounds": [
        [
          54,
          82,
          202,
          224
        ],
        [
          77,
          82,
          180,
          224
        ],
        [
          84,
          89,
          173,
          224
        ],
        [
          71,
          82,
          186,
          224
        ],
        [
          55,
          83,
          201,
          224
        ],
        [
          71,
          82,
          186,
          224
        ],
        [
          84,
          89,
          173,
          224
        ],
        [
          77,
          82,
          179,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "orc--raider-orc",
      "name": "Raider Orc",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "orc",
      "identitySource": "archive/art-reference/monsters/humanoid/orc/raider-orc/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-orc-raider-orc.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-orc-raider-orc_1794031311834_74b527e7.png",
      "sheet": "sheets/variants/orc--raider-orc.png",
      "sheetSha256": "79550bbdad8c88a74a49fe93777c3702d9a4acd4bada5c7fde5c8f9b4392d33b",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-orc--raider-orc-diagonals.png",
      "diagonalSheetSha256": "f7b3fa90e6a5815dd39260a1fdc6837392f46abce1b14915d026cd7304165596",
      "atlas": "atlases/variants/orc--raider-orc.png",
      "sourceBounds": [
        [
          88,
          82,
          169,
          224
        ],
        [
          83,
          82,
          173,
          224
        ],
        [
          88,
          82,
          168,
          224
        ],
        [
          85,
          81,
          172,
          224
        ],
        [
          89,
          83,
          168,
          224
        ],
        [
          83,
          82,
          173,
          224
        ],
        [
          87,
          82,
          169,
          224
        ],
        [
          83,
          82,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "orc--berserker-orc",
      "name": "Berserker Orc",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "orc",
      "identitySource": "archive/art-reference/monsters/humanoid/orc/berserker-orc/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-orc-berserker-orc.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-orc-berserker-orc_1794031328909_9fc2425d.png",
      "sheet": "sheets/variants/orc--berserker-orc.png",
      "sheetSha256": "7449a5403dbff9be4efb45beb7b6ad8b16c6d80dc915768ee83c0dfc9a2eebb9",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-orc--berserker-orc-diagonals.png",
      "diagonalSheetSha256": "2aa64d3241102d2cad8bf6a3cc56d786ac55d0aa89de7e12be1297a7430c895e",
      "atlas": "atlases/variants/orc--berserker-orc.png",
      "sourceBounds": [
        [
          83,
          82,
          174,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          86,
          83,
          171,
          224
        ],
        [
          85,
          82,
          171,
          224
        ],
        [
          85,
          83,
          172,
          224
        ],
        [
          84,
          82,
          172,
          224
        ],
        [
          85,
          83,
          171,
          224
        ],
        [
          85,
          82,
          171,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "orc--ashen-orc",
      "name": "Ashen Orc",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "orc",
      "identitySource": "archive/art-reference/monsters/humanoid/orc/ashen-orc/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-orc-ashen-orc.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-orc-ashen-orc_1794031349911_8c9d3272.png",
      "sheet": "sheets/variants/orc--ashen-orc.png",
      "sheetSha256": "0521dc6457b111009955165bd95fe20ca5bb88307d1fed9a48dd441d0da27b91",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-orc--ashen-orc-diagonals.png",
      "diagonalSheetSha256": "09aad96f977aa1ba7db9413cfa2c09c7c8b894f8e81b0557980eebd0dbbcaf36",
      "atlas": "atlases/variants/orc--ashen-orc.png",
      "sourceBounds": [
        [
          66,
          83,
          190,
          224
        ],
        [
          79,
          82,
          178,
          224
        ],
        [
          87,
          93,
          169,
          224
        ],
        [
          84,
          82,
          172,
          224
        ],
        [
          67,
          82,
          190,
          224
        ],
        [
          83,
          82,
          174,
          224
        ],
        [
          87,
          93,
          169,
          224
        ],
        [
          79,
          82,
          178,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "kobold--scavenger-kobold",
      "name": "Scavenger Kobold",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "kobold",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-kobold-scavenger-kobold.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-kobold-scavenger-kobold_1794031496254_024e1c89.png",
      "sheet": "sheets/variants/kobold--scavenger-kobold.png",
      "sheetSha256": "2acacea9af949a7c03b3ff9a5238b8291673dedfa55190307b41c1bf9e81a799",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-kobold--scavenger-kobold-diagonals.png",
      "diagonalSheetSha256": "b4435cd5b019eee6538b75a44a987a595153dca67019b05c56b676ad89f33657",
      "atlas": "atlases/variants/kobold--scavenger-kobold.png",
      "sourceBounds": [
        [
          59,
          83,
          197,
          224
        ],
        [
          70,
          85,
          187,
          224
        ],
        [
          72,
          83,
          185,
          224
        ],
        [
          74,
          83,
          183,
          224
        ],
        [
          62,
          82,
          195,
          224
        ],
        [
          76,
          78,
          180,
          224
        ],
        [
          72,
          83,
          184,
          224
        ],
        [
          73,
          81,
          183,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "kobold--miner-kobold",
      "name": "Miner Kobold",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "kobold",
      "identitySource": "archive/art-reference/monsters/humanoid/kobold/miner-kobold/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-kobold-miner-kobold.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-kobold-miner-kobold_1794031517003_ed7975fd.png",
      "sheet": "sheets/variants/kobold--miner-kobold.png",
      "sheetSha256": "12b1ac24eabdc6ed9f5b8b7a48e88c63722769c091b14b69897bb38c65a79dad",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-kobold--miner-kobold-diagonals.png",
      "diagonalSheetSha256": "19428eed31f41e427473a94a75d46b44f473cb59f99e38f63040cee590d8ed64",
      "atlas": "atlases/variants/kobold--miner-kobold.png",
      "sourceBounds": [
        [
          59,
          85,
          197,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          79,
          90,
          177,
          224
        ],
        [
          73,
          82,
          183,
          224
        ],
        [
          62,
          82,
          194,
          224
        ],
        [
          73,
          82,
          183,
          224
        ],
        [
          79,
          90,
          177,
          224
        ],
        [
          76,
          82,
          180,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "kobold--tinker-kobold",
      "name": "Tinker Kobold",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "kobold",
      "identitySource": "archive/art-reference/monsters/humanoid/kobold/tinker-kobold/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-kobold-tinker-kobold.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-kobold-tinker-kobold_1794031541748_8c153a3b.png",
      "sheet": "sheets/variants/kobold--tinker-kobold.png",
      "sheetSha256": "d549deee09d48e4714156d9fc4868fa0b4ca8907af9f2c42272529a9d869661e",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-kobold--tinker-kobold-diagonals.png",
      "diagonalSheetSha256": "77c37bda3e353f6cb62edae1f244331e31b7ab3949a20c3d8a3b40ae2faa9c19",
      "atlas": "atlases/variants/kobold--tinker-kobold.png",
      "sourceBounds": [
        [
          59,
          89,
          198,
          224
        ],
        [
          69,
          84,
          187,
          224
        ],
        [
          68,
          89,
          188,
          224
        ],
        [
          68,
          81,
          188,
          224
        ],
        [
          58,
          82,
          199,
          224
        ],
        [
          68,
          80,
          188,
          224
        ],
        [
          68,
          89,
          189,
          224
        ],
        [
          68,
          83,
          189,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "kobold--drake-kobold",
      "name": "Drake Kobold",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "kobold",
      "identitySource": "archive/art-reference/monsters/humanoid/kobold/drake-kobold/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-kobold-drake-kobold.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-kobold-drake-kobold_1794031759137_f677a414.png",
      "sheet": "sheets/variants/kobold--drake-kobold.png",
      "sheetSha256": "2f41ea3dd5e05765ae9197c1ddda8915f149edc5402047a0b5c2a4c3ad5529f3",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-kobold--drake-kobold-diagonals.png",
      "diagonalSheetSha256": "e71f6304eae96d0e0d3f73e4dddd13aa6e73613daaff7ae00128507213ed5e8a",
      "atlas": "atlases/variants/kobold--drake-kobold.png",
      "sourceBounds": [
        [
          87,
          83,
          169,
          224
        ],
        [
          84,
          82,
          172,
          224
        ],
        [
          83,
          91,
          173,
          224
        ],
        [
          87,
          82,
          169,
          224
        ],
        [
          91,
          82,
          166,
          224
        ],
        [
          87,
          82,
          169,
          224
        ],
        [
          83,
          91,
          173,
          224
        ],
        [
          84,
          82,
          172,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "kobold--flintlock-kobold",
      "name": "Flintlock Kobold",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "kobold",
      "identitySource": "archive/art-reference/monsters/humanoid/kobold/flintlock-kobold/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-kobold-flintlock-kobold.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-kobold-flintlock-kobold_1794031777591_87518921.png",
      "sheet": "sheets/variants/kobold--flintlock-kobold.png",
      "sheetSha256": "090277a44682a9ecf672cea5eb24ea9e9c83484f35e943e9fc18fa72d6692e65",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-kobold--flintlock-kobold-diagonals.png",
      "diagonalSheetSha256": "9e94d56099355dfb3a5753c5e4c42acaa02c5ec7688351c0fef036a0ac4232d4",
      "atlas": "atlases/variants/kobold--flintlock-kobold.png",
      "sourceBounds": [
        [
          65,
          85,
          191,
          224
        ],
        [
          75,
          82,
          181,
          224
        ],
        [
          72,
          84,
          185,
          224
        ],
        [
          72,
          80,
          184,
          224
        ],
        [
          67,
          82,
          190,
          224
        ],
        [
          78,
          82,
          179,
          224
        ],
        [
          73,
          86,
          184,
          224
        ],
        [
          78,
          83,
          178,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ogre--brute-ogre",
      "name": "Brute Ogre",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "ogre",
      "identitySource": "archive/art-reference/monsters/humanoid/ogre/brute-ogre/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-ogre-brute-ogre.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ogre-brute-ogre_1794031955877_44a63d0c.png",
      "sheet": "sheets/variants/ogre--brute-ogre.png",
      "sheetSha256": "47b5b4cb504cce028bd7f3db33b04d9f4f2b4ac4bb2063a15a8eaf07565de3c1",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ogre--brute-ogre-diagonals.png",
      "diagonalSheetSha256": "bb75b9d41131b0f3757119c513ec16cf2c93b16c4d19ff91d16bbd844730f1e9",
      "atlas": "atlases/variants/ogre--brute-ogre.png",
      "sourceBounds": [
        [
          82,
          82,
          175,
          224
        ],
        [
          83,
          78,
          174,
          224
        ],
        [
          87,
          89,
          169,
          224
        ],
        [
          83,
          79,
          174,
          224
        ],
        [
          81,
          83,
          175,
          224
        ],
        [
          83,
          85,
          173,
          224
        ],
        [
          87,
          89,
          170,
          224
        ],
        [
          83,
          85,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ogre--swamp-ogre",
      "name": "Swamp Ogre",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "ogre",
      "identitySource": "archive/art-reference/monsters/humanoid/ogre/swamp-ogre/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-ogre-swamp-ogre.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ogre-swamp-ogre_1794032417107_e1e6dd02.png",
      "sheet": "sheets/variants/ogre--swamp-ogre.png",
      "sheetSha256": "d56f239f3939093c0fbc785d36126f873e929beb0ab3ba9870c1dc4635fdaca1",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ogre--swamp-ogre-diagonals.png",
      "diagonalSheetSha256": "4ec0774c2c6dc730376851d67b71913228a38cf4a6d31ca55ee1cef83b4f56fa",
      "atlas": "atlases/variants/ogre--swamp-ogre.png",
      "sourceBounds": [
        [
          80,
          82,
          177,
          224
        ],
        [
          84,
          80,
          173,
          224
        ],
        [
          86,
          86,
          170,
          224
        ],
        [
          84,
          80,
          173,
          224
        ],
        [
          80,
          82,
          177,
          224
        ],
        [
          83,
          84,
          174,
          224
        ],
        [
          86,
          87,
          170,
          224
        ],
        [
          83,
          84,
          174,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ogre--mesa-ogre",
      "name": "Mesa Ogre",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "ogre",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-ogre-mesa-ogre.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ogre-mesa-ogre_1794032004318_078c67a6.png",
      "sheet": "sheets/variants/ogre--mesa-ogre.png",
      "sheetSha256": "1503a4fa12011a15c99c236048e8d2b4ddabb0450e9abbf08496de03fcf67495",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ogre--mesa-ogre-diagonals.png",
      "diagonalSheetSha256": "c49161aa31515930d1bf3758f7d9ccbb121d8161fdbee5271aa5b304e8a231e1",
      "atlas": "atlases/variants/ogre--mesa-ogre.png",
      "sourceBounds": [
        [
          82,
          82,
          175,
          224
        ],
        [
          83,
          81,
          173,
          224
        ],
        [
          88,
          85,
          169,
          224
        ],
        [
          84,
          81,
          173,
          224
        ],
        [
          82,
          83,
          174,
          224
        ],
        [
          83,
          83,
          173,
          224
        ],
        [
          87,
          85,
          169,
          224
        ],
        [
          83,
          83,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ogre--oathbrand-ogre",
      "name": "Oathbrand Ogre",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "ogre",
      "identitySource": "archive/art-reference/monsters/humanoid/ogre/oathbrand-ogre/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-ogre-oathbrand-ogre.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ogre-oathbrand-ogre_1794032020749_7c780bf2.png",
      "sheet": "sheets/variants/ogre--oathbrand-ogre.png",
      "sheetSha256": "49d79df0e56418ac9f7cedb5387e6d7925bafcd447077de7afb3c9dd33bc1ade",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ogre--oathbrand-ogre-diagonals.png",
      "diagonalSheetSha256": "9ea07fc5e96f31553bc4e5b0975ca1be40acf1dfbbf36b78418039c3fcf7efac",
      "atlas": "atlases/variants/ogre--oathbrand-ogre.png",
      "sourceBounds": [
        [
          85,
          82,
          172,
          224
        ],
        [
          82,
          82,
          174,
          224
        ],
        [
          92,
          86,
          165,
          224
        ],
        [
          82,
          82,
          174,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          84,
          82,
          173,
          224
        ],
        [
          91,
          85,
          165,
          224
        ],
        [
          84,
          82,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "troll--cave-troll",
      "name": "Cave Troll",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "troll",
      "identitySource": "archive/art-reference/monsters/humanoid/troll/cave-troll/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-troll-cave-troll.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-troll-cave-troll_1794032638979_1f9e446e.png",
      "sheet": "sheets/variants/troll--cave-troll.png",
      "sheetSha256": "4d50a85d3f181c76df3a77e325c8e55863d051d487c78cd552713bb9fb5d1dee",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-troll--cave-troll-diagonals.png",
      "diagonalSheetSha256": "ed2633413be3fb2f941342c6215551b08219f377c5063add997d3bf82c987d0c",
      "atlas": "atlases/variants/troll--cave-troll.png",
      "sourceBounds": [
        [
          86,
          82,
          170,
          224
        ],
        [
          87,
          82,
          169,
          224
        ],
        [
          92,
          82,
          165,
          224
        ],
        [
          89,
          82,
          167,
          224
        ],
        [
          85,
          83,
          171,
          224
        ],
        [
          88,
          82,
          169,
          224
        ],
        [
          93,
          82,
          164,
          224
        ],
        [
          88,
          82,
          169,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "troll--swamp-troll",
      "name": "Swamp Troll",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "troll",
      "identitySource": "archive/art-reference/monsters/humanoid/troll/swamp-troll/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-troll-swamp-troll.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-troll-swamp-troll_1794032830308_90c6edd2.png",
      "sheet": "sheets/variants/troll--swamp-troll.png",
      "sheetSha256": "9ee547f372a4d4aff90d49270624608b2fa538d3f1f78c73534b4b8921959152",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-troll--swamp-troll-diagonals.png",
      "diagonalSheetSha256": "2b8fc05171bd9d91a0c23b0047f7fe2fe32365d1258ef1bddd64ab823f150aac",
      "atlas": "atlases/variants/troll--swamp-troll.png",
      "sourceBounds": [
        [
          82,
          85,
          175,
          224
        ],
        [
          89,
          85,
          167,
          224
        ],
        [
          88,
          82,
          168,
          224
        ],
        [
          90,
          82,
          167,
          224
        ],
        [
          82,
          85,
          174,
          224
        ],
        [
          89,
          81,
          167,
          224
        ],
        [
          88,
          83,
          168,
          224
        ],
        [
          89,
          82,
          167,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "troll--reed-troll",
      "name": "Reed Troll",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "troll",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-troll-reed-troll.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-troll-reed-troll_1794032687539_249de500.png",
      "sheet": "sheets/variants/troll--reed-troll.png",
      "sheetSha256": "96e23d642a8553448e65d7f4f8a4cf2508d37cd3b804bfa7de84346c8638e6ee",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-troll--reed-troll-diagonals.png",
      "diagonalSheetSha256": "f484d686989f4ef4dda4ddcb20b1963385f69a4260e7c174dd92aa2aa004a24b",
      "atlas": "atlases/variants/troll--reed-troll.png",
      "sourceBounds": [
        [
          75,
          85,
          182,
          224
        ],
        [
          83,
          84,
          173,
          224
        ],
        [
          81,
          82,
          175,
          224
        ],
        [
          86,
          84,
          171,
          224
        ],
        [
          76,
          85,
          181,
          224
        ],
        [
          87,
          80,
          170,
          224
        ],
        [
          80,
          83,
          176,
          224
        ],
        [
          84,
          80,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "troll--oldgrowth-troll",
      "name": "Oldgrowth Troll",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "troll",
      "identitySource": "archive/art-reference/monsters/humanoid/troll/oldgrowth-troll/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-troll-oldgrowth-troll.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-troll-oldgrowth-troll_1794032707010_efcdabde.png",
      "sheet": "sheets/variants/troll--oldgrowth-troll.png",
      "sheetSha256": "e71ea78df50a0af3773f7180c297848f012560af10a5a65ef7e08a0344747dbc",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-troll--oldgrowth-troll-diagonals.png",
      "diagonalSheetSha256": "98fbf604e59db0b5fe6dc886e06c0ff515438cd3aa2d20c083fd5ad8c8eaeb7d",
      "atlas": "atlases/variants/troll--oldgrowth-troll.png",
      "sourceBounds": [
        [
          82,
          83,
          174,
          224
        ],
        [
          89,
          82,
          168,
          224
        ],
        [
          90,
          85,
          167,
          224
        ],
        [
          90,
          82,
          166,
          224
        ],
        [
          83,
          82,
          174,
          224
        ],
        [
          90,
          82,
          166,
          224
        ],
        [
          91,
          85,
          166,
          224
        ],
        [
          89,
          82,
          168,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "minotaur--maze-warden-minotaur",
      "name": "Maze Warden Minotaur",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "minotaur",
      "identitySource": "archive/art-reference/monsters/humanoid/minotaur/maze-warden-minotaur/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-minotaur-maze-warden-minotaur.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-minotaur-maze-warden-minotaur_1794032963759_eed59d0c.png",
      "sheet": "sheets/variants/minotaur--maze-warden-minotaur.png",
      "sheetSha256": "201c10f2a05a6335429b3ea8452d91158d4d47162663d8703bd805077aa9921d",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-minotaur--maze-warden-minotaur-diagonals.png",
      "diagonalSheetSha256": "e4638cbc97bd995326005c3695878f1d0e06f5accd6eb23d4bcb0d473d6babed",
      "atlas": "atlases/variants/minotaur--maze-warden-minotaur.png",
      "sourceBounds": [
        [
          76,
          83,
          180,
          224
        ],
        [
          82,
          84,
          175,
          224
        ],
        [
          83,
          82,
          174,
          224
        ],
        [
          85,
          84,
          171,
          224
        ],
        [
          77,
          85,
          179,
          224
        ],
        [
          82,
          80,
          175,
          224
        ],
        [
          83,
          82,
          174,
          224
        ],
        [
          82,
          80,
          174,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "skeleton--knight-skeleton",
      "name": "Knight Skeleton",
      "race": "undead",
      "kind": "variant",
      "variantOf": "skeleton",
      "identitySource": "archive/art-reference/monsters/undead/skeleton/knight-skeleton/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-skeleton-knight-skeleton.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-skeleton-knight-skeleton_1794032847683_7f657c9b.png",
      "sheet": "sheets/variants/skeleton--knight-skeleton.png",
      "sheetSha256": "bf3362162400a132cf60ff205960bbda70a41ffaa1faa235c591fd13874cb682",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-skeleton--knight-skeleton-diagonals.png",
      "diagonalSheetSha256": "54c3648631f24984c36c2c38fd4b13c96781658a19d64b299e2a8d348e8be10d",
      "atlas": "atlases/variants/skeleton--knight-skeleton.png",
      "sourceBounds": [
        [
          88,
          82,
          169,
          224
        ],
        [
          92,
          82,
          165,
          224
        ],
        [
          93,
          87,
          163,
          224
        ],
        [
          92,
          82,
          164,
          224
        ],
        [
          87,
          82,
          170,
          224
        ],
        [
          94,
          83,
          163,
          224
        ],
        [
          93,
          87,
          164,
          224
        ],
        [
          92,
          82,
          165,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "skeleton--mage-skeleton",
      "name": "Mage Skeleton",
      "race": "undead",
      "kind": "variant",
      "variantOf": "skeleton",
      "identitySource": "archive/art-reference/monsters/undead/skeleton/mage-skeleton/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-skeleton-mage-skeleton.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-skeleton-mage-skeleton_1794032876677_4bcc2ee9.png",
      "sheet": "sheets/variants/skeleton--mage-skeleton.png",
      "sheetSha256": "c0da9160cbf4143256972b3fb442359b41ab0c22b3ded85de91d9033f86e5e58",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-skeleton--mage-skeleton-diagonals.png",
      "diagonalSheetSha256": "006fd46f4c8d774c1dbefe638a5a74589cfa9b145bd00e024f45850b17ac6dbc",
      "atlas": "atlases/variants/skeleton--mage-skeleton.png",
      "sourceBounds": [
        [
          84,
          82,
          173,
          224
        ],
        [
          90,
          82,
          166,
          224
        ],
        [
          87,
          83,
          170,
          224
        ],
        [
          88,
          82,
          169,
          224
        ],
        [
          80,
          82,
          176,
          224
        ],
        [
          88,
          82,
          168,
          224
        ],
        [
          89,
          84,
          168,
          224
        ],
        [
          90,
          82,
          167,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "skeleton--drowned-skeleton",
      "name": "Drowned Skeleton",
      "race": "undead",
      "kind": "variant",
      "variantOf": "skeleton",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-skeleton-drowned-skeleton.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-skeleton-drowned-skeleton_1794032895401_c2564936.png",
      "sheet": "sheets/variants/skeleton--drowned-skeleton.png",
      "sheetSha256": "37d3a72e4a5eaa1a3b2ad85841a5593770eca7cca3e7a290b89cdee02a1c411b",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-skeleton--drowned-skeleton-diagonals.png",
      "diagonalSheetSha256": "0d9b8f409e55d3deb289bb704793f3db7ab1073a7cfbaabf83aa8bd0e64b8cf4",
      "atlas": "atlases/variants/skeleton--drowned-skeleton.png",
      "sourceBounds": [
        [
          97,
          82,
          159,
          224
        ],
        [
          96,
          81,
          160,
          224
        ],
        [
          96,
          87,
          161,
          224
        ],
        [
          96,
          82,
          160,
          224
        ],
        [
          97,
          82,
          160,
          224
        ],
        [
          96,
          83,
          160,
          224
        ],
        [
          96,
          87,
          161,
          224
        ],
        [
          96,
          82,
          160,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "skeleton--rattleblade-skeleton",
      "name": "Rattleblade Skeleton",
      "race": "undead",
      "kind": "variant",
      "variantOf": "skeleton",
      "identitySource": "archive/art-reference/monsters/undead/skeleton/rattleblade-skeleton/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-skeleton-rattleblade-skeleton.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-skeleton-rattleblade-skeleton_1794032923634_1b44ec59.png",
      "sheet": "sheets/variants/skeleton--rattleblade-skeleton.png",
      "sheetSha256": "2dbc378600068986965adf2c7f06d69d018ec32662d342b550063927fa02dcf3",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-skeleton--rattleblade-skeleton-diagonals.png",
      "diagonalSheetSha256": "ff22a25fa61b1768c0897625c06da0da1ba5277d6e28a8ddc5a17e4945f6408e",
      "atlas": "atlases/variants/skeleton--rattleblade-skeleton.png",
      "sourceBounds": [
        [
          101,
          82,
          156,
          224
        ],
        [
          100,
          82,
          157,
          224
        ],
        [
          100,
          84,
          156,
          224
        ],
        [
          100,
          82,
          157,
          224
        ],
        [
          101,
          82,
          156,
          224
        ],
        [
          100,
          82,
          156,
          224
        ],
        [
          100,
          84,
          156,
          224
        ],
        [
          100,
          82,
          157,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "skeleton--crownless-skeleton",
      "name": "Crownless Skeleton",
      "race": "undead",
      "kind": "variant",
      "variantOf": "skeleton",
      "identitySource": "archive/art-reference/monsters/undead/skeleton/crownless-skeleton/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-skeleton-crownless-skeleton.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-skeleton-crownless-skeleton_1794032943911_44931916.png",
      "sheet": "sheets/variants/skeleton--crownless-skeleton.png",
      "sheetSha256": "699beddd05cc2a2218c680623a8754550e8b961f96c46b06abde2fea2549522e",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-skeleton--crownless-skeleton-diagonals.png",
      "diagonalSheetSha256": "83d530104a7f3cc1fdbe98b06f4c6900513a783ef64c8a4ba9f623bb3d149593",
      "atlas": "atlases/variants/skeleton--crownless-skeleton.png",
      "sourceBounds": [
        [
          94,
          82,
          162,
          224
        ],
        [
          94,
          81,
          163,
          224
        ],
        [
          96,
          84,
          160,
          224
        ],
        [
          96,
          82,
          161,
          224
        ],
        [
          94,
          82,
          163,
          224
        ],
        [
          95,
          83,
          162,
          224
        ],
        [
          96,
          84,
          160,
          224
        ],
        [
          93,
          82,
          164,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "mummy--ashwrap-mummy",
      "name": "Ashwrap Mummy",
      "race": "undead",
      "kind": "variant",
      "variantOf": "mummy",
      "identitySource": "archive/art-reference/monsters/undead/mummy/ashwrap-mummy/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-mummy-ashwrap-mummy.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-mummy-ashwrap-mummy_1794033107323_28929acd.png",
      "sheet": "sheets/variants/mummy--ashwrap-mummy.png",
      "sheetSha256": "50d38b4419ce711f9c6e23437b8b6f009803599d7e301e0675ad148a4be58e1c",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-mummy--ashwrap-mummy-diagonals.png",
      "diagonalSheetSha256": "c735ff0057f6af6576d7d14f5cf5c99bcfa8889d63e04314bb79c4f533af964a",
      "atlas": "atlases/variants/mummy--ashwrap-mummy.png",
      "sourceBounds": [
        [
          90,
          82,
          166,
          224
        ],
        [
          90,
          83,
          167,
          224
        ],
        [
          92,
          82,
          165,
          224
        ],
        [
          90,
          83,
          167,
          224
        ],
        [
          91,
          82,
          165,
          224
        ],
        [
          89,
          81,
          167,
          224
        ],
        [
          91,
          82,
          165,
          224
        ],
        [
          89,
          81,
          167,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "mummy--cartouche-mummy",
      "name": "Cartouche Mummy",
      "race": "undead",
      "kind": "variant",
      "variantOf": "mummy",
      "identitySource": "archive/art-reference/monsters/undead/mummy/cartouche-mummy/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-mummy-cartouche-mummy.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-mummy-cartouche-mummy_1794033125009_57424a2f.png",
      "sheet": "sheets/variants/mummy--cartouche-mummy.png",
      "sheetSha256": "491d3ca7de807a39f7567b7a10576b08b7f3288ce8ca1e1dbe0636feabc6f98f",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-mummy--cartouche-mummy-diagonals.png",
      "diagonalSheetSha256": "c24cc100028220f0304faef95179f6572eeda1c991ae9208a20921f387d40b97",
      "atlas": "atlases/variants/mummy--cartouche-mummy.png",
      "sourceBounds": [
        [
          86,
          83,
          171,
          224
        ],
        [
          87,
          82,
          170,
          224
        ],
        [
          84,
          82,
          173,
          224
        ],
        [
          87,
          82,
          169,
          224
        ],
        [
          89,
          83,
          168,
          224
        ],
        [
          87,
          82,
          170,
          224
        ],
        [
          84,
          82,
          173,
          224
        ],
        [
          87,
          82,
          170,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "mummy--vault-mummy",
      "name": "Vault Mummy",
      "race": "undead",
      "kind": "variant",
      "variantOf": "mummy",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-mummy-vault-mummy.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-mummy-vault-mummy_1794033145149_6301c1d1.png",
      "sheet": "sheets/variants/mummy--vault-mummy.png",
      "sheetSha256": "2af36723c3fac7071c0b6279d390d81e979e601bdec897afb06bf74afcad07a4",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-mummy--vault-mummy-diagonals.png",
      "diagonalSheetSha256": "98a726b527314b960ec43dd4c45eb68616776f62ba718982e30bee92f1a1e154",
      "atlas": "atlases/variants/mummy--vault-mummy.png",
      "sourceBounds": [
        [
          90,
          82,
          167,
          224
        ],
        [
          90,
          80,
          167,
          224
        ],
        [
          92,
          90,
          164,
          224
        ],
        [
          89,
          80,
          167,
          224
        ],
        [
          90,
          82,
          166,
          224
        ],
        [
          90,
          84,
          167,
          224
        ],
        [
          92,
          90,
          164,
          224
        ],
        [
          90,
          84,
          167,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "vampire--crimson-knight-vampire",
      "name": "Crimson Knight Vampire",
      "race": "undead",
      "kind": "variant",
      "variantOf": "vampire",
      "identitySource": "archive/art-reference/monsters/undead/vampire/crimson-knight-vampire/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-vampire-crimson-knight-vampire.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-vampire-crimson-knight-vampire_1794033162933_7017b9d8.png",
      "sheet": "sheets/variants/vampire--crimson-knight-vampire.png",
      "sheetSha256": "8e850ce61fb038aa7d23734713c84e167adbdb8451764b653601feb433dad890",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-vampire--crimson-knight-vampire-diagonals.png",
      "diagonalSheetSha256": "20a383b78b918889cfcaca6bf210472bcd6387993fe67ead67a8550af11f4842",
      "atlas": "atlases/variants/vampire--crimson-knight-vampire.png",
      "sourceBounds": [
        [
          81,
          84,
          176,
          224
        ],
        [
          78,
          82,
          178,
          224
        ],
        [
          89,
          82,
          168,
          224
        ],
        [
          79,
          82,
          177,
          224
        ],
        [
          82,
          84,
          174,
          224
        ],
        [
          78,
          82,
          179,
          224
        ],
        [
          88,
          82,
          168,
          224
        ],
        [
          78,
          82,
          178,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "vampire--night-lord-vampire",
      "name": "Night Lord Vampire",
      "race": "undead",
      "kind": "variant",
      "variantOf": "vampire",
      "identitySource": "archive/art-reference/monsters/undead/vampire/night-lord-vampire/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-vampire-night-lord-vampire.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-vampire-night-lord-vampire_1794033180320_6f84191a.png",
      "sheet": "sheets/variants/vampire--night-lord-vampire.png",
      "sheetSha256": "077eb9e3d5cf378626c075a9f68e7fcd11edbd7873c46d8b7dbf7cce1721754c",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-vampire--night-lord-vampire-diagonals.png",
      "diagonalSheetSha256": "818b7f58062b12dc5c1f943d8f48da597dd6a0d086e276a85521686aad0f1d14",
      "atlas": "atlases/variants/vampire--night-lord-vampire.png",
      "sourceBounds": [
        [
          88,
          85,
          168,
          224
        ],
        [
          86,
          82,
          170,
          224
        ],
        [
          96,
          82,
          161,
          224
        ],
        [
          85,
          82,
          171,
          224
        ],
        [
          88,
          85,
          169,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          95,
          82,
          161,
          224
        ],
        [
          86,
          82,
          170,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "vampire--bloodveil-vampire",
      "name": "Bloodveil Vampire",
      "race": "undead",
      "kind": "variant",
      "variantOf": "vampire",
      "identitySource": "archive/art-reference/monsters/undead/vampire/bloodveil-vampire/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-vampire-bloodveil-vampire.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-vampire-bloodveil-vampire_1794033207339_a517b394.png",
      "sheet": "sheets/variants/vampire--bloodveil-vampire.png",
      "sheetSha256": "f7578df7f8fd7e7f498ae43c93662dc9be1014b06150ff8481d6c0b5b3e18988",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-vampire--bloodveil-vampire-diagonals.png",
      "diagonalSheetSha256": "7f1aeba5d0d770ef54ab61fe43b22d90df1b6cea6cf95ef3a56eed3e2058261f",
      "atlas": "atlases/variants/vampire--bloodveil-vampire.png",
      "sourceBounds": [
        [
          76,
          84,
          181,
          224
        ],
        [
          83,
          82,
          174,
          224
        ],
        [
          85,
          82,
          171,
          224
        ],
        [
          83,
          82,
          173,
          224
        ],
        [
          75,
          83,
          181,
          224
        ],
        [
          84,
          82,
          173,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          83,
          82,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "vampire--grave-count-vampire",
      "name": "Grave Count Vampire",
      "race": "undead",
      "kind": "variant",
      "variantOf": "vampire",
      "identitySource": "archive/art-reference/monsters/undead/vampire/grave-count-vampire/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-vampire-grave-count-vampire.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-vampire-grave-count-vampire_1794033231666_3f1dadd0.png",
      "sheet": "sheets/variants/vampire--grave-count-vampire.png",
      "sheetSha256": "e62730a12ba8074ffe05638f9c3acf3c6b0fdc469e70e44e51d990edd0a504f5",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-vampire--grave-count-vampire-diagonals.png",
      "diagonalSheetSha256": "91ffbdfc50c85837250c794a58f909e4b522a008f1f0d7fccd6297d9517c3127",
      "atlas": "atlases/variants/vampire--grave-count-vampire.png",
      "sourceBounds": [
        [
          84,
          84,
          173,
          224
        ],
        [
          88,
          82,
          168,
          224
        ],
        [
          95,
          89,
          162,
          224
        ],
        [
          89,
          82,
          168,
          224
        ],
        [
          85,
          82,
          171,
          224
        ],
        [
          89,
          82,
          168,
          224
        ],
        [
          93,
          87,
          164,
          224
        ],
        [
          89,
          82,
          168,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "demon--ember-knight-demon",
      "name": "Ember Knight Demon",
      "race": "demon",
      "kind": "variant",
      "variantOf": "demon",
      "identitySource": "archive/art-reference/monsters/demon/demon/ember-knight-demon/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-demon-ember-knight-demon.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-demon-ember-knight-demon_1794033726353_f0cc6582.png",
      "sheet": "sheets/variants/demon--ember-knight-demon.png",
      "sheetSha256": "67a3941ea49956ae40bc8b6434064a2825579b713c57f21cd56913e0ad9511ac",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-demon--ember-knight-demon-diagonals.png",
      "diagonalSheetSha256": "c6673a71860c42adca945d987cd79545fa8917daf52c958ce937946da95c9c17",
      "atlas": "atlases/variants/demon--ember-knight-demon.png",
      "sourceBounds": [
        [
          85,
          82,
          172,
          224
        ],
        [
          96,
          82,
          160,
          224
        ],
        [
          98,
          86,
          158,
          224
        ],
        [
          93,
          82,
          163,
          224
        ],
        [
          86,
          83,
          170,
          224
        ],
        [
          93,
          82,
          163,
          224
        ],
        [
          97,
          86,
          159,
          224
        ],
        [
          97,
          82,
          160,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "demon--dread-herald-demon",
      "name": "Dread Herald Demon",
      "race": "demon",
      "kind": "variant",
      "variantOf": "demon",
      "identitySource": "archive/art-reference/monsters/demon/demon/dread-herald-demon/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-demon-dread-herald-demon.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-demon-dread-herald-demon_1794033377375_d9f511a6.png",
      "sheet": "sheets/variants/demon--dread-herald-demon.png",
      "sheetSha256": "bb13d85eff88d1c6577871d9077676daadef3d738e662f1f02869e332994beaf",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-demon--dread-herald-demon-diagonals.png",
      "diagonalSheetSha256": "9e33c74a173f419509d5c7496362e22993bc04bad0add22255bd08241e977b57",
      "atlas": "atlases/variants/demon--dread-herald-demon.png",
      "sourceBounds": [
        [
          78,
          82,
          179,
          224
        ],
        [
          85,
          82,
          172,
          224
        ],
        [
          97,
          83,
          160,
          224
        ],
        [
          83,
          82,
          173,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          84,
          82,
          173,
          224
        ],
        [
          96,
          83,
          160,
          224
        ],
        [
          84,
          82,
          172,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--orchard-slime",
      "name": "Orchard Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-orchard-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-orchard-slime_1794033421341_89dedacd.png",
      "sheet": "sheets/variants/slime--orchard-slime.png",
      "sheetSha256": "a5038c4a709daed932d6094c2175887df27da20ce377d81f94017bbcf8941364",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--orchard-slime-diagonals.png",
      "diagonalSheetSha256": "6a6d7e92ca1ce8766fa114cb06676f6f90cb05dee457c5f27c8ae4aae95d254b",
      "atlas": "atlases/variants/slime--orchard-slime.png",
      "sourceBounds": [
        [
          54,
          92,
          202,
          224
        ],
        [
          53,
          90,
          204,
          224
        ],
        [
          54,
          90,
          203,
          224
        ],
        [
          52,
          89,
          204,
          224
        ],
        [
          55,
          91,
          202,
          224
        ],
        [
          52,
          89,
          204,
          224
        ],
        [
          53,
          89,
          203,
          224
        ],
        [
          52,
          89,
          204,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--devourer-slime",
      "name": "Devourer Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": "archive/art-reference/monsters/formless/slime/devourer-slime/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-devourer-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-devourer-slime_1794033445427_33292a66.png",
      "sheet": "sheets/variants/slime--devourer-slime.png",
      "sheetSha256": "7d3480cc25901d539aa3e190cc2ef92dcafa82ee13b19b7b3b85c6e27fccd629",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--devourer-slime-diagonals.png",
      "diagonalSheetSha256": "f30750e31d823c6ada6dd3b83587a341e1cd119f772607f5b0b22c8767fb1144",
      "atlas": "atlases/variants/slime--devourer-slime.png",
      "sourceBounds": [
        [
          55,
          131,
          202,
          224
        ],
        [
          61,
          131,
          195,
          224
        ],
        [
          57,
          134,
          199,
          224
        ],
        [
          62,
          131,
          195,
          224
        ],
        [
          53,
          131,
          203,
          224
        ],
        [
          61,
          131,
          195,
          224
        ],
        [
          57,
          134,
          200,
          224
        ],
        [
          62,
          131,
          195,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--bog-slime",
      "name": "Bog Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": "archive/art-reference/monsters/formless/slime/bog-slime/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-bog-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-bog-slime_1794033465454_05d9f55a.png",
      "sheet": "sheets/variants/slime--bog-slime.png",
      "sheetSha256": "7605d6474a0a84380f62c917fa83ee5d609b4ca73ad2fcdb9c23cedc5ff0c6eb",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--bog-slime-diagonals.png",
      "diagonalSheetSha256": "949958d31881a205dcf95c13c47406632c2ac6dae8f4ea005c3a48d33444cdf8",
      "atlas": "atlases/variants/slime--bog-slime.png",
      "sourceBounds": [
        [
          65,
          82,
          192,
          224
        ],
        [
          66,
          82,
          190,
          224
        ],
        [
          67,
          87,
          190,
          224
        ],
        [
          68,
          80,
          188,
          224
        ],
        [
          65,
          82,
          191,
          224
        ],
        [
          68,
          83,
          188,
          224
        ],
        [
          67,
          86,
          190,
          224
        ],
        [
          68,
          82,
          188,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--rime-slime",
      "name": "Rime Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-rime-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-rime-slime_1794033480952_4063a0f1.png",
      "sheet": "sheets/variants/slime--rime-slime.png",
      "sheetSha256": "f7d277308f7613cf723b46d8e75f2ad31662d1d274c713e563b2d6c00f114677",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--rime-slime-diagonals.png",
      "diagonalSheetSha256": "1dec98c85d0e28082df02a0a30a29059b3d8d4a4975078db62c80c6a93ed0f74",
      "atlas": "atlases/variants/slime--rime-slime.png",
      "sourceBounds": [
        [
          53,
          93,
          203,
          224
        ],
        [
          59,
          93,
          198,
          224
        ],
        [
          57,
          100,
          199,
          224
        ],
        [
          59,
          93,
          197,
          224
        ],
        [
          54,
          93,
          203,
          224
        ],
        [
          58,
          93,
          199,
          224
        ],
        [
          58,
          100,
          199,
          224
        ],
        [
          58,
          93,
          198,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--slag-slime",
      "name": "Slag Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-slag-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-slag-slime_1794033745540_75045348.png",
      "sheet": "sheets/variants/slime--slag-slime.png",
      "sheetSha256": "6bd720f4c59825cfd447407aebbfc3035b66c2f9fb6ca90e64f28467274b8f87",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--slag-slime-diagonals.png",
      "diagonalSheetSha256": "b8e1451a21a26adc1d7bcd85b72b97a9bc2e21ad139b5e5d4c2c1c0c26b97d46",
      "atlas": "atlases/variants/slime--slag-slime.png",
      "sourceBounds": [
        [
          56,
          115,
          200,
          224
        ],
        [
          61,
          115,
          196,
          224
        ],
        [
          53,
          117,
          203,
          224
        ],
        [
          61,
          115,
          195,
          224
        ],
        [
          55,
          116,
          202,
          224
        ],
        [
          60,
          115,
          197,
          224
        ],
        [
          54,
          117,
          203,
          224
        ],
        [
          60,
          115,
          197,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--abyss-slime",
      "name": "Abyss Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-abyss-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-abyss-slime_1794033762187_31859846.png",
      "sheet": "sheets/variants/slime--abyss-slime.png",
      "sheetSha256": "137b83ad300df69ff98c914e42269a625f0fdc489ff9ee359a2aa7914dc4990f",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--abyss-slime-diagonals.png",
      "diagonalSheetSha256": "68ed0a94ac7a2fece9e0fa6f58c7d66750f476172b202167925bfeed0da0c729",
      "atlas": "atlases/variants/slime--abyss-slime.png",
      "sourceBounds": [
        [
          53,
          104,
          203,
          224
        ],
        [
          51,
          105,
          205,
          224
        ],
        [
          56,
          108,
          201,
          224
        ],
        [
          52,
          104,
          204,
          224
        ],
        [
          53,
          104,
          203,
          224
        ],
        [
          51,
          104,
          206,
          224
        ],
        [
          54,
          108,
          202,
          224
        ],
        [
          51,
          104,
          205,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--brook-slime",
      "name": "Brook Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-brook-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-brook-slime_1794033777672_5edb8a97.png",
      "sheet": "sheets/variants/slime--brook-slime.png",
      "sheetSha256": "c97284d49484f832e121f3b9d6f8386bc1c25b7b490cd2f413afc5350ab90a21",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--brook-slime-diagonals.png",
      "diagonalSheetSha256": "1d57b78187b38bf3e0afdb3f544da3a953afd4e5b25ad5f224ae7cacb32e72d3",
      "atlas": "atlases/variants/slime--brook-slime.png",
      "sourceBounds": [
        [
          53,
          99,
          203,
          224
        ],
        [
          52,
          99,
          204,
          224
        ],
        [
          55,
          104,
          201,
          224
        ],
        [
          52,
          98,
          204,
          224
        ],
        [
          53,
          99,
          203,
          224
        ],
        [
          52,
          99,
          205,
          224
        ],
        [
          56,
          104,
          201,
          224
        ],
        [
          52,
          100,
          204,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slime--deepwater-slime",
      "name": "Deepwater Slime",
      "race": "formless",
      "kind": "variant",
      "variantOf": "slime",
      "identitySource": "archive/art-reference/monsters/formless/slime/deepwater-slime/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-slime-deepwater-slime.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slime-deepwater-slime_1794033801220_47c70279.png",
      "sheet": "sheets/variants/slime--deepwater-slime.png",
      "sheetSha256": "e685a8403238eafa637142ce812bab11b65d82ac86df16d0b2383e31a59b1ade",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slime--deepwater-slime-diagonals.png",
      "diagonalSheetSha256": "729709518df7dc21a4d5aa79c0f43d214487c0d700281536afdded0140c98411",
      "atlas": "atlases/variants/slime--deepwater-slime.png",
      "sourceBounds": [
        [
          53,
          101,
          203,
          224
        ],
        [
          53,
          101,
          203,
          224
        ],
        [
          59,
          110,
          198,
          224
        ],
        [
          55,
          102,
          202,
          224
        ],
        [
          53,
          101,
          203,
          224
        ],
        [
          53,
          101,
          203,
          224
        ],
        [
          59,
          110,
          198,
          224
        ],
        [
          53,
          101,
          203,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider--orchard-spider",
      "name": "Orchard Spider",
      "race": "insect",
      "kind": "variant",
      "variantOf": "spider",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-spider-orchard-spider.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-spider-orchard-spider_1794034067739_c93444c6.png",
      "sheet": "sheets/variants/spider--orchard-spider.png",
      "sheetSha256": "f4b1eb453a08f7abb075030f01ed28b2ae7fc5256fd5c285a6d8aa4e80985359",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider--orchard-spider-diagonals.png",
      "diagonalSheetSha256": "2946b0aa2a550a7233c27755dc40b46c8d6c06983b99fc4263e95fdf45229b1d",
      "atlas": "atlases/variants/spider--orchard-spider.png",
      "sourceBounds": [
        [
          54,
          145,
          202,
          224
        ],
        [
          57,
          146,
          199,
          224
        ],
        [
          61,
          148,
          196,
          224
        ],
        [
          59,
          145,
          198,
          224
        ],
        [
          53,
          145,
          203,
          224
        ],
        [
          59,
          143,
          198,
          224
        ],
        [
          61,
          148,
          195,
          224
        ],
        [
          59,
          145,
          197,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider--cave-spider",
      "name": "Cave Spider",
      "race": "insect",
      "kind": "variant",
      "variantOf": "spider",
      "identitySource": "archive/art-reference/monsters/insect/spider/cave-spider/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-spider-cave-spider.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-spider-cave-spider_1794034085056_48c88ae3.png",
      "sheet": "sheets/variants/spider--cave-spider.png",
      "sheetSha256": "55a755ba4d036e4a48f92f88936a92fd3bd54a19c14bb4b59c24cfd723477974",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider--cave-spider-diagonals.png",
      "diagonalSheetSha256": "2e2cc90ab43470958ffa6cef6c31d294f9261e9c7f85f2534368338ef89e1992",
      "atlas": "atlases/variants/spider--cave-spider.png",
      "sourceBounds": [
        [
          54,
          138,
          202,
          224
        ],
        [
          57,
          138,
          200,
          224
        ],
        [
          60,
          139,
          196,
          224
        ],
        [
          57,
          138,
          200,
          224
        ],
        [
          53,
          139,
          203,
          224
        ],
        [
          57,
          138,
          200,
          224
        ],
        [
          60,
          139,
          196,
          224
        ],
        [
          57,
          139,
          200,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider--web-spider",
      "name": "Web Spider",
      "race": "insect",
      "kind": "variant",
      "variantOf": "spider",
      "identitySource": "archive/art-reference/monsters/insect/spider/web-spider/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-spider-web-spider.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-spider-web-spider_1794034103696_eb0bc62f.png",
      "sheet": "sheets/variants/spider--web-spider.png",
      "sheetSha256": "d1d8f8e70d1f8f1313a00263f2e8d19139767268542a99925b5287b380b2e16d",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider--web-spider-diagonals.png",
      "diagonalSheetSha256": "7820f1c298b3a639c8a65a1c058aea5d2c4625a99ac33bb4b356a5b28deea08c",
      "atlas": "atlases/variants/spider--web-spider.png",
      "sourceBounds": [
        [
          55,
          129,
          201,
          224
        ],
        [
          62,
          128,
          195,
          224
        ],
        [
          63,
          141,
          194,
          224
        ],
        [
          61,
          130,
          195,
          224
        ],
        [
          53,
          135,
          203,
          224
        ],
        [
          62,
          130,
          195,
          224
        ],
        [
          62,
          143,
          194,
          224
        ],
        [
          62,
          128,
          195,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider--venom-spider",
      "name": "Venom Spider",
      "race": "insect",
      "kind": "variant",
      "variantOf": "spider",
      "identitySource": "archive/art-reference/monsters/insect/spider/venom-spider/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-spider-venom-spider.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-spider-venom-spider_1794034124434_bef8e2d8.png",
      "sheet": "sheets/variants/spider--venom-spider.png",
      "sheetSha256": "537b0b01d44d1e4a8a5b7bed2936f4481add3a2481a8dfa6cd5b71c93593caab",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider--venom-spider-diagonals.png",
      "diagonalSheetSha256": "e8b0dc8c7c652b3d9cde3d59a524aefba98c3e16b81aff782ee3744505f1c15b",
      "atlas": "atlases/variants/spider--venom-spider.png",
      "sourceBounds": [
        [
          53,
          144,
          203,
          224
        ],
        [
          64,
          141,
          192,
          224
        ],
        [
          64,
          143,
          193,
          224
        ],
        [
          70,
          143,
          187,
          224
        ],
        [
          53,
          142,
          203,
          224
        ],
        [
          66,
          142,
          190,
          224
        ],
        [
          64,
          143,
          192,
          224
        ],
        [
          65,
          142,
          191,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider--mossback-spider",
      "name": "Mossback Spider",
      "race": "insect",
      "kind": "variant",
      "variantOf": "spider",
      "identitySource": "archive/art-reference/monsters/insect/spider/mossback-spider/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-spider-mossback-spider.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-spider-mossback-spider_1794034142713_8534bcf0.png",
      "sheet": "sheets/variants/spider--mossback-spider.png",
      "sheetSha256": "ba415c0b5e6e07f27fcbdfef98d19bd5ad18f29b8a15a816e039cdb05e58c21e",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider--mossback-spider-diagonals.png",
      "diagonalSheetSha256": "dd33dbf9836d017d77948632b1e73fe76c460fa3e6754a7be0c1dcf3cbe613b2",
      "atlas": "atlases/variants/spider--mossback-spider.png",
      "sourceBounds": [
        [
          54,
          139,
          202,
          224
        ],
        [
          63,
          137,
          193,
          224
        ],
        [
          61,
          140,
          196,
          224
        ],
        [
          65,
          141,
          192,
          224
        ],
        [
          53,
          140,
          203,
          224
        ],
        [
          64,
          141,
          192,
          224
        ],
        [
          60,
          140,
          196,
          224
        ],
        [
          63,
          137,
          193,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider--fenweb-spider",
      "name": "Fenweb Spider",
      "race": "insect",
      "kind": "variant",
      "variantOf": "spider",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-spider-fenweb-spider.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-spider-fenweb-spider_1794034160128_1c12de1c.png",
      "sheet": "sheets/variants/spider--fenweb-spider.png",
      "sheetSha256": "b93af52d83fdaca03a5bffaa81ef43f0753eeddcca896914dbb9911d8f91f871",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider--fenweb-spider-diagonals.png",
      "diagonalSheetSha256": "4a79770d133017ce87a94ba8d36c99721b1dc1f3f65107cd9453ef7c4ffcdce2",
      "atlas": "atlases/variants/spider--fenweb-spider.png",
      "sourceBounds": [
        [
          54,
          137,
          202,
          224
        ],
        [
          63,
          132,
          193,
          224
        ],
        [
          59,
          139,
          198,
          224
        ],
        [
          65,
          144,
          192,
          224
        ],
        [
          53,
          139,
          203,
          224
        ],
        [
          63,
          142,
          193,
          224
        ],
        [
          60,
          139,
          197,
          224
        ],
        [
          63,
          128,
          194,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "spider--moonweb-spider",
      "name": "Moonweb Spider",
      "race": "insect",
      "kind": "variant",
      "variantOf": "spider",
      "identitySource": "archive/art-reference/monsters/insect/spider/moonweb-spider/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-spider-moonweb-spider.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-spider-moonweb-spider_1794034179122_9a2089aa.png",
      "sheet": "sheets/variants/spider--moonweb-spider.png",
      "sheetSha256": "6c1378ef7c00f90826f1bf6cd80dd4c4620f73fbfed14320266d229fc7d1566d",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-spider--moonweb-spider-diagonals.png",
      "diagonalSheetSha256": "ba08ca5b75432be8e8039f2b997a0fb9116f627f25e385ee213c1143a372b262",
      "atlas": "atlases/variants/spider--moonweb-spider.png",
      "sourceBounds": [
        [
          53,
          121,
          203,
          224
        ],
        [
          56,
          118,
          201,
          224
        ],
        [
          57,
          137,
          200,
          224
        ],
        [
          56,
          123,
          200,
          224
        ],
        [
          58,
          129,
          199,
          224
        ],
        [
          57,
          124,
          199,
          224
        ],
        [
          59,
          140,
          197,
          224
        ],
        [
          55,
          119,
          202,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wolf--hunting-wolf",
      "name": "Hunting Wolf",
      "race": "beast",
      "kind": "variant",
      "variantOf": "wolf",
      "identitySource": "archive/art-reference/monsters/beast/wolf/hunting-wolf/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wolf-hunting-wolf.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wolf-hunting-wolf_1794034868712_4a3d002b.png",
      "sheet": "sheets/variants/wolf--hunting-wolf.png",
      "sheetSha256": "cabaa6cb66558ad33f885e7a8b6d176b53530c2d963274b96fd3b5f18524af4a",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wolf--hunting-wolf-diagonals.png",
      "diagonalSheetSha256": "735c203cf4f03fcc876742b4689a715bb6c547d25ff918fcf4ef7158e29c15ab",
      "atlas": "atlases/variants/wolf--hunting-wolf.png",
      "sourceBounds": [
        [
          99,
          113,
          158,
          224
        ],
        [
          77,
          114,
          179,
          224
        ],
        [
          53,
          119,
          203,
          224
        ],
        [
          83,
          111,
          174,
          224
        ],
        [
          101,
          126,
          155,
          224
        ],
        [
          85,
          112,
          172,
          224
        ],
        [
          53,
          119,
          203,
          224
        ],
        [
          77,
          114,
          180,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wolf--shadow-wolf",
      "name": "Shadow Wolf",
      "race": "beast",
      "kind": "variant",
      "variantOf": "wolf",
      "identitySource": "archive/art-reference/monsters/beast/wolf/shadow-wolf/source/reference.png",
      "identityKind": "reference",
      "board": "docs/art-reference/pawn-study/sources/variant-wolf-shadow-wolf.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wolf-shadow-wolf_1794034500091_be80e798.png",
      "sheet": "sheets/variants/wolf--shadow-wolf.png",
      "sheetSha256": "39c9df0d902c01f2afee8ad44b458ccdae14a776d80318a13a3cb62699a17f59",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wolf--shadow-wolf-diagonals.png",
      "diagonalSheetSha256": "ce352c4b1debc78ce5e0f9c2e94e30d888fae32dba7cc7341902ef2cb957b954",
      "atlas": "atlases/variants/wolf--shadow-wolf.png",
      "sourceBounds": [
        [
          97,
          100,
          160,
          224
        ],
        [
          61,
          89,
          196,
          224
        ],
        [
          55,
          119,
          202,
          224
        ],
        [
          73,
          83,
          184,
          224
        ],
        [
          102,
          87,
          155,
          224
        ],
        [
          71,
          85,
          185,
          224
        ],
        [
          53,
          118,
          203,
          224
        ],
        [
          60,
          89,
          196,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wolf--moonfang-wolf",
      "name": "Moonfang Wolf",
      "race": "beast",
      "kind": "variant",
      "variantOf": "wolf",
      "identitySource": "archive/art-reference/monsters/beast/wolf/moonfang-wolf/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wolf-moonfang-wolf.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wolf-moonfang-wolf_1794034518317_4a19e79e.png",
      "sheet": "sheets/variants/wolf--moonfang-wolf.png",
      "sheetSha256": "f43d7f13958fefa4204f10eede7a01b3ceea5382bf50e1ac8f7be7e9c2289a74",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wolf--moonfang-wolf-diagonals.png",
      "diagonalSheetSha256": "c10be41e9aa57c9338c347a9e91cbfa0da16cbd18cb7033105663ca954d1e023",
      "atlas": "atlases/variants/wolf--moonfang-wolf.png",
      "sourceBounds": [
        [
          97,
          112,
          160,
          224
        ],
        [
          69,
          105,
          188,
          224
        ],
        [
          55,
          124,
          201,
          224
        ],
        [
          75,
          101,
          181,
          224
        ],
        [
          100,
          103,
          157,
          224
        ],
        [
          75,
          101,
          182,
          224
        ],
        [
          53,
          124,
          203,
          224
        ],
        [
          69,
          105,
          187,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem--stone-golem",
      "name": "Stone Golem",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "golem",
      "identitySource": "archive/art-reference/monsters/elemental/golem/stone-golem/source/reference.png",
      "identityKind": "reference",
      "board": "docs/art-reference/pawn-study/sources/variant-golem-stone-golem.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-golem-stone-golem_1794038811805_b54a088e.png",
      "sheet": "sheets/variants/golem--stone-golem.png",
      "sheetSha256": "c347920e5a12a39f26e6d948cb68807212f563e1afb3b2236b52e90da0b78dce",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem--stone-golem-diagonals.png",
      "diagonalSheetSha256": "292e9c717ab1c07a6777cf5d09be97457deae6127910c3ce2ed3d59182abedb0",
      "atlas": "atlases/variants/golem--stone-golem.png",
      "sourceBounds": [
        [
          72,
          84,
          184,
          224
        ],
        [
          77,
          83,
          180,
          224
        ],
        [
          80,
          82,
          177,
          224
        ],
        [
          77,
          83,
          179,
          224
        ],
        [
          71,
          84,
          185,
          224
        ],
        [
          76,
          81,
          180,
          224
        ],
        [
          80,
          82,
          177,
          224
        ],
        [
          77,
          81,
          180,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem--guardian-golem",
      "name": "Guardian Golem",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "golem",
      "identitySource": "archive/art-reference/monsters/elemental/golem/guardian-golem/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-golem-guardian-golem.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-golem-guardian-golem_1794034542554_4d9f5b9d.png",
      "sheet": "sheets/variants/golem--guardian-golem.png",
      "sheetSha256": "e60c65f831c8e6de0f61ae92bb7433ddd31d5e9329ab1ebeccd7d7ae91d8c40f",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem--guardian-golem-diagonals.png",
      "diagonalSheetSha256": "579f32efed5f3c5f30baeb68042828fdbdd94020851fbf9272c26d1c3b34cb1d",
      "atlas": "atlases/variants/golem--guardian-golem.png",
      "sourceBounds": [
        [
          68,
          83,
          189,
          224
        ],
        [
          70,
          83,
          187,
          224
        ],
        [
          79,
          87,
          178,
          224
        ],
        [
          70,
          83,
          187,
          224
        ],
        [
          67,
          83,
          189,
          224
        ],
        [
          70,
          83,
          187,
          224
        ],
        [
          78,
          87,
          178,
          224
        ],
        [
          70,
          83,
          187,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem--crystal-golem",
      "name": "Crystal Golem",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "golem",
      "identitySource": "archive/art-reference/monsters/elemental/golem/crystal-golem/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-golem-crystal-golem.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-golem-crystal-golem_1794034561947_ee04e331.png",
      "sheet": "sheets/variants/golem--crystal-golem.png",
      "sheetSha256": "ae7d10b1ce2a8748745a54cb150766bcfd6d2e60b3cb56db68144fc9fc0491b6",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem--crystal-golem-diagonals.png",
      "diagonalSheetSha256": "d5a50f9fd8550c4d403b98dd56e7984191c28a33f8da8207d2e30497f26023db",
      "atlas": "atlases/variants/golem--crystal-golem.png",
      "sourceBounds": [
        [
          78,
          82,
          179,
          224
        ],
        [
          80,
          80,
          176,
          224
        ],
        [
          89,
          87,
          167,
          224
        ],
        [
          80,
          80,
          176,
          224
        ],
        [
          74,
          82,
          183,
          224
        ],
        [
          81,
          85,
          176,
          224
        ],
        [
          86,
          87,
          170,
          224
        ],
        [
          81,
          84,
          176,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem--drowned-golem",
      "name": "Drowned Golem",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "golem",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-golem-drowned-golem.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-golem-drowned-golem_1794034583460_0832865d.png",
      "sheet": "sheets/variants/golem--drowned-golem.png",
      "sheetSha256": "5cc50ad02fd5914ac1541f06acd15423157c6c4cb78220871b20c989ee6978db",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem--drowned-golem-diagonals.png",
      "diagonalSheetSha256": "69a87bf483a1f4e7eded7f26a3eb8aba9a74f33b680fb80beb6f41d566ab2390",
      "atlas": "atlases/variants/golem--drowned-golem.png",
      "sourceBounds": [
        [
          77,
          82,
          180,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          80,
          82,
          177,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          79,
          83,
          177,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          78,
          82,
          178,
          224
        ],
        [
          77,
          82,
          180,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem--vault-golem",
      "name": "Vault Golem",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "golem",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-golem-vault-golem.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-golem-vault-golem_1794034886140_837fd3cd.png",
      "sheet": "sheets/variants/golem--vault-golem.png",
      "sheetSha256": "f8ab6ec557e63d626150a0ed09b7da53431d1de637e0fbcb6f73fa6cabf089c9",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem--vault-golem-diagonals.png",
      "diagonalSheetSha256": "385d6e42c50daeb6b7e6418966d780ea87b706bb84078fd2de56c1d72ff8b791",
      "atlas": "atlases/variants/golem--vault-golem.png",
      "sourceBounds": [
        [
          74,
          83,
          182,
          224
        ],
        [
          74,
          82,
          182,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          75,
          82,
          182,
          224
        ],
        [
          75,
          83,
          181,
          224
        ],
        [
          75,
          82,
          182,
          224
        ],
        [
          79,
          82,
          177,
          224
        ],
        [
          75,
          82,
          182,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem--watchtower-golem",
      "name": "Watchtower Golem",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "golem",
      "identitySource": "archive/art-reference/monsters/elemental/golem/watchtower-golem/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-golem-watchtower-golem.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-golem-watchtower-golem_1794034909705_a0e3b16c.png",
      "sheet": "sheets/variants/golem--watchtower-golem.png",
      "sheetSha256": "ca7592da72e4b0f7cb7a63fde3f8502ca66cab8446860657700100ce5105356f",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem--watchtower-golem-diagonals.png",
      "diagonalSheetSha256": "925b247999226c838e9564bdaf30fab443eb40551951c15616f675cf0f36f706",
      "atlas": "atlases/variants/golem--watchtower-golem.png",
      "sourceBounds": [
        [
          78,
          85,
          179,
          224
        ],
        [
          85,
          84,
          171,
          224
        ],
        [
          94,
          84,
          163,
          224
        ],
        [
          85,
          84,
          172,
          224
        ],
        [
          78,
          85,
          179,
          224
        ],
        [
          85,
          84,
          171,
          224
        ],
        [
          94,
          84,
          163,
          224
        ],
        [
          85,
          84,
          171,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "golem--icebound-golem",
      "name": "Icebound Golem",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "golem",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-golem-icebound-golem.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-golem-icebound-golem_1794034926153_7cc7e50a.png",
      "sheet": "sheets/variants/golem--icebound-golem.png",
      "sheetSha256": "44760bbce396e167950e43fd92121c9db560bdb4240aeeb0f0176433d31b2a97",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-golem--icebound-golem-diagonals.png",
      "diagonalSheetSha256": "25bdf53baf64a49a10c2089fad68669e3f58420e3fed82d5d23e8fcfc77b2807",
      "atlas": "atlases/variants/golem--icebound-golem.png",
      "sourceBounds": [
        [
          79,
          83,
          178,
          224
        ],
        [
          79,
          83,
          177,
          224
        ],
        [
          85,
          91,
          171,
          224
        ],
        [
          79,
          83,
          177,
          224
        ],
        [
          79,
          83,
          177,
          224
        ],
        [
          80,
          83,
          177,
          224
        ],
        [
          84,
          90,
          172,
          224
        ],
        [
          80,
          83,
          177,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "dragon--wyrmling",
      "name": "Wyrmling",
      "race": "dragon",
      "kind": "variant",
      "variantOf": "dragon",
      "identitySource": "archive/art-reference/monsters/dragon/dragon/wyrmling/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-dragon-wyrmling.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-dragon-wyrmling_1794034989841_7098c511.png",
      "sheet": "sheets/variants/dragon--wyrmling.png",
      "sheetSha256": "d31c8cc593d84d151049eb6596ae4b2fc6617ea857a76db91f87159f12a29a4c",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-dragon--wyrmling-diagonals.png",
      "diagonalSheetSha256": "0b6b71ca84ca59f884493f9517d44715b0317d4306db15ddb0775b9b518a1b29",
      "atlas": "atlases/variants/dragon--wyrmling.png",
      "sourceBounds": [
        [
          71,
          89,
          185,
          224
        ],
        [
          62,
          89,
          195,
          224
        ],
        [
          53,
          110,
          203,
          224
        ],
        [
          66,
          89,
          191,
          224
        ],
        [
          76,
          89,
          181,
          224
        ],
        [
          64,
          89,
          192,
          224
        ],
        [
          54,
          110,
          203,
          224
        ],
        [
          62,
          89,
          195,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "dragon--dawnfire-dragon",
      "name": "Dawnfire Dragon",
      "race": "dragon",
      "kind": "variant",
      "variantOf": "dragon",
      "identitySource": "archive/art-reference/monsters/dragon/dragon/dawnfire-dragon/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-dragon-dawnfire-dragon.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-dragon-dawnfire-dragon_1794034945299_d32cd03e.png",
      "sheet": "sheets/variants/dragon--dawnfire-dragon.png",
      "sheetSha256": "5ca1c46bd14e627152c2974844df76be272ab2ce6ae5963eafd9d7f25d054747",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-dragon--dawnfire-dragon-diagonals.png",
      "diagonalSheetSha256": "0e2fab0f35a2644565abd5ac9d0df9976c8259e1f9e60ebf6ffc622aa51bf09f",
      "atlas": "atlases/variants/dragon--dawnfire-dragon.png",
      "sourceBounds": [
        [
          74,
          94,
          183,
          224
        ],
        [
          55,
          94,
          202,
          224
        ],
        [
          53,
          97,
          203,
          224
        ],
        [
          64,
          94,
          192,
          224
        ],
        [
          73,
          96,
          183,
          224
        ],
        [
          64,
          95,
          192,
          224
        ],
        [
          55,
          98,
          202,
          224
        ],
        [
          55,
          94,
          202,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "dragon--rime-dragon",
      "name": "Rime Dragon",
      "race": "dragon",
      "kind": "variant",
      "variantOf": "dragon",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-dragon-rime-dragon.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-dragon-rime-dragon_1794034964270_21208847.png",
      "sheet": "sheets/variants/dragon--rime-dragon.png",
      "sheetSha256": "2f66836c0669ee859ad2984eb596072e3cde206358c4d359422a021cb80781a9",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-dragon--rime-dragon-diagonals.png",
      "diagonalSheetSha256": "f8ab81ba71b342782384c4fb880f52efdba7497952314dbff450805829e0911b",
      "atlas": "atlases/variants/dragon--rime-dragon.png",
      "sourceBounds": [
        [
          83,
          104,
          174,
          224
        ],
        [
          69,
          104,
          187,
          224
        ],
        [
          56,
          107,
          201,
          224
        ],
        [
          79,
          105,
          177,
          224
        ],
        [
          83,
          109,
          174,
          224
        ],
        [
          75,
          104,
          182,
          224
        ],
        [
          53,
          105,
          203,
          224
        ],
        [
          69,
          104,
          188,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "treant--rotting-treant",
      "name": "Rotting Treant",
      "race": "plant",
      "kind": "variant",
      "variantOf": "treant",
      "identitySource": "archive/art-reference/monsters/plant/treant/rotting-treant/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-treant-rotting-treant.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-treant-rotting-treant_1794035432624_c1820146.png",
      "sheet": "sheets/variants/treant--rotting-treant.png",
      "sheetSha256": "90d7839cd67214b4c557872f384f5b167ff4f81397ab8ddf412e132a1f26cb22",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-treant--rotting-treant-diagonals.png",
      "diagonalSheetSha256": "707569f6d0867d4c92c88ab9bcba3830ccdbc50162d0355791744251ebc6d8b7",
      "atlas": "atlases/variants/treant--rotting-treant.png",
      "sourceBounds": [
        [
          69,
          82,
          188,
          224
        ],
        [
          73,
          79,
          183,
          224
        ],
        [
          81,
          87,
          176,
          224
        ],
        [
          76,
          80,
          180,
          224
        ],
        [
          64,
          82,
          193,
          224
        ],
        [
          78,
          84,
          179,
          224
        ],
        [
          79,
          87,
          178,
          224
        ],
        [
          78,
          85,
          179,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "treant--thicket-treant",
      "name": "Thicket Treant",
      "race": "plant",
      "kind": "variant",
      "variantOf": "treant",
      "identitySource": "archive/art-reference/monsters/plant/treant/thicket-treant/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-treant-thicket-treant.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-treant-thicket-treant_1794035452434_ec076a98.png",
      "sheet": "sheets/variants/treant--thicket-treant.png",
      "sheetSha256": "96daa30590c63a5c93e903ef8261f42bf2a1fe8839516336349767ba8c2fa7f1",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-treant--thicket-treant-diagonals.png",
      "diagonalSheetSha256": "8c27b0d9ff587e711c93a8a63b308467cef052f94857e530e9b80f219b6c7fbb",
      "atlas": "atlases/variants/treant--thicket-treant.png",
      "sourceBounds": [
        [
          67,
          82,
          190,
          224
        ],
        [
          68,
          81,
          188,
          224
        ],
        [
          77,
          86,
          180,
          224
        ],
        [
          71,
          82,
          186,
          224
        ],
        [
          67,
          83,
          189,
          224
        ],
        [
          71,
          83,
          186,
          224
        ],
        [
          78,
          84,
          179,
          224
        ],
        [
          72,
          82,
          184,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "treant--groveheart-treant",
      "name": "Groveheart Treant",
      "race": "plant",
      "kind": "variant",
      "variantOf": "treant",
      "identitySource": "archive/art-reference/monsters/plant/treant/groveheart-treant/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-treant-groveheart-treant.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-treant-groveheart-treant_1794035472724_7b62923b.png",
      "sheet": "sheets/variants/treant--groveheart-treant.png",
      "sheetSha256": "4b0c4e174f5133fd8af42b0f0decef24e360e259558f0007f118ae0f78a033aa",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-treant--groveheart-treant-diagonals.png",
      "diagonalSheetSha256": "16189d6bbfb58b4be97a6dc9967e11913cb9a9d3ae70e527b79d526c997f1f1d",
      "atlas": "atlases/variants/treant--groveheart-treant.png",
      "sourceBounds": [
        [
          67,
          82,
          190,
          224
        ],
        [
          77,
          82,
          180,
          224
        ],
        [
          85,
          84,
          172,
          224
        ],
        [
          79,
          82,
          178,
          224
        ],
        [
          68,
          84,
          189,
          224
        ],
        [
          80,
          84,
          176,
          224
        ],
        [
          84,
          84,
          173,
          224
        ],
        [
          81,
          82,
          175,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "human--orchard-poacher",
      "name": "Orchard Poacher",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "human",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-human-orchard-poacher.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-human-orchard-poacher_1794035488486_3b03e5a0.png",
      "sheet": "sheets/variants/human--orchard-poacher.png",
      "sheetSha256": "cb4dbd41225e322fd0adde4ba48d1e57912915dfc475c34e87718db78c22aa06",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-human--orchard-poacher-diagonals.png",
      "diagonalSheetSha256": "1413a224b35ca496f2b7096c52876f021909769ebf048901fbcaf23eeaf40fba",
      "atlas": "atlases/variants/human--orchard-poacher.png",
      "sourceBounds": [
        [
          84,
          82,
          173,
          224
        ],
        [
          84,
          83,
          173,
          224
        ],
        [
          84,
          83,
          172,
          224
        ],
        [
          83,
          83,
          173,
          224
        ],
        [
          84,
          82,
          172,
          224
        ],
        [
          82,
          81,
          175,
          224
        ],
        [
          84,
          83,
          172,
          224
        ],
        [
          82,
          81,
          174,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "human--ranger",
      "name": "Ranger",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "human",
      "identitySource": "archive/art-reference/monsters/humanoid/human/ranger/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-human-ranger.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-human-ranger_1794036049668_3d6db7ac.png",
      "sheet": "sheets/variants/human--ranger.png",
      "sheetSha256": "d9b87330d76da41550f32bea9062dc6c40149d362f442c6956bf2bc1ecff1aa1",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-human--ranger-diagonals.png",
      "diagonalSheetSha256": "92505850c30e0cae9e00d2a598fdee658153f4da2e0e221175ac5a349d73d787",
      "atlas": "atlases/variants/human--ranger.png",
      "sourceBounds": [
        [
          83,
          82,
          173,
          224
        ],
        [
          85,
          82,
          171,
          224
        ],
        [
          88,
          89,
          169,
          224
        ],
        [
          86,
          82,
          170,
          224
        ],
        [
          84,
          82,
          173,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          88,
          89,
          168,
          224
        ],
        [
          85,
          82,
          171,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "human--knight",
      "name": "Knight",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "human",
      "identitySource": "archive/art-reference/monsters/humanoid/human/knight/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-human-knight.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-human-knight_1794035530346_a2d11d8c.png",
      "sheet": "sheets/variants/human--knight.png",
      "sheetSha256": "7f0026ea0979ad941e89a6c0d41619e0e7f39bbf931a270ab3102c2dfc622630",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-human--knight-diagonals.png",
      "diagonalSheetSha256": "f25612a087c701f4bd88858d9d45ddc8d4717e227828a2b5396af66d34a36f03",
      "atlas": "atlases/variants/human--knight.png",
      "sourceBounds": [
        [
          84,
          84,
          173,
          224
        ],
        [
          85,
          81,
          171,
          224
        ],
        [
          85,
          89,
          172,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          84,
          82,
          173,
          224
        ],
        [
          85,
          82,
          171,
          224
        ],
        [
          83,
          87,
          173,
          224
        ],
        [
          84,
          82,
          172,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "human--mage",
      "name": "Mage",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "human",
      "identitySource": "archive/art-reference/monsters/humanoid/human/mage/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-human-mage.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-human-mage_1794035907253_69f4a106.png",
      "sheet": "sheets/variants/human--mage.png",
      "sheetSha256": "5dadf44878a774aa2509359536d0e5f75425bfbd5a25281a8b58ea467d014e24",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-human--mage-diagonals.png",
      "diagonalSheetSha256": "cce5e28d4a65295a8e093cd73aee379e0f4aa6718eed8b06e3df3ea13753ba7a",
      "atlas": "atlases/variants/human--mage.png",
      "sourceBounds": [
        [
          86,
          85,
          171,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          85,
          82,
          171,
          224
        ],
        [
          86,
          85,
          171,
          224
        ],
        [
          85,
          82,
          172,
          224
        ],
        [
          86,
          83,
          170,
          224
        ],
        [
          85,
          82,
          171,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "human--banner-captain",
      "name": "Banner Captain",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "human",
      "identitySource": "archive/art-reference/monsters/humanoid/human/banner-captain/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-human-banner-captain.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-human-banner-captain_1794036401870_748b6c3d.png",
      "sheet": "sheets/variants/human--banner-captain.png",
      "sheetSha256": "04014f51ce95b711928959842bff51981d66879c55aae5d9f283212acfd7fc3d",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-human--banner-captain-diagonals.png",
      "diagonalSheetSha256": "2dd17d0adba2affe8074ab83311bd7efbe9bfd60118a6614099219e89792803f",
      "atlas": "atlases/variants/human--banner-captain.png",
      "sourceBounds": [
        [
          83,
          84,
          173,
          224
        ],
        [
          76,
          82,
          181,
          224
        ],
        [
          75,
          82,
          181,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          78,
          84,
          179,
          224
        ],
        [
          77,
          82,
          179,
          224
        ],
        [
          76,
          82,
          180,
          224
        ],
        [
          78,
          82,
          179,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "lizardman--scale-knight-lizardman",
      "name": "Scale Knight Lizardman",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "lizardman",
      "identitySource": "archive/art-reference/monsters/humanoid/lizardman/scale-knight-lizardman/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-lizardman-scale-knight-lizardman.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-lizardman-scale-knight-lizardman_1794035950420_4dd4d640.png",
      "sheet": "sheets/variants/lizardman--scale-knight-lizardman.png",
      "sheetSha256": "0c432d1a8722d8e662eb13e028a79161651bc4e216873f2c9e9983db0d802183",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-lizardman--scale-knight-lizardman-diagonals.png",
      "diagonalSheetSha256": "e51a9c990a53d5916dfdcd6a2832b3947ccc5244c1d82b85f94a11a1953c41a5",
      "atlas": "atlases/variants/lizardman--scale-knight-lizardman.png",
      "sourceBounds": [
        [
          95,
          121,
          161,
          224
        ],
        [
          98,
          121,
          159,
          224
        ],
        [
          86,
          128,
          170,
          224
        ],
        [
          100,
          120,
          156,
          224
        ],
        [
          96,
          121,
          161,
          224
        ],
        [
          97,
          121,
          160,
          224
        ],
        [
          86,
          128,
          170,
          224
        ],
        [
          94,
          122,
          162,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "lizardman--reed-spear-lizardman",
      "name": "Reed Spear Lizardman",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "lizardman",
      "identitySource": "archive/art-reference/monsters/humanoid/lizardman/reed-spear-lizardman/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-lizardman-reed-spear-lizardman.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-lizardman-reed-spear-lizardman_1794035966167_822a4b5c.png",
      "sheet": "sheets/variants/lizardman--reed-spear-lizardman.png",
      "sheetSha256": "080f7e7bdb0926879feec13f2bfe46c7097b1acb4dc03efdb19e5a43f538013a",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-lizardman--reed-spear-lizardman-diagonals.png",
      "diagonalSheetSha256": "08a4b1a865b951cb534cdfdd93b53a76dcf2c627dff6b382d072a3a85487e590",
      "atlas": "atlases/variants/lizardman--reed-spear-lizardman.png",
      "sourceBounds": [
        [
          88,
          85,
          168,
          224
        ],
        [
          88,
          83,
          169,
          224
        ],
        [
          70,
          82,
          186,
          224
        ],
        [
          96,
          81,
          160,
          224
        ],
        [
          97,
          85,
          160,
          224
        ],
        [
          96,
          81,
          160,
          224
        ],
        [
          70,
          82,
          186,
          224
        ],
        [
          88,
          84,
          168,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "lizardman--mire-lizardman",
      "name": "Mire Lizardman",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "lizardman",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-lizardman-mire-lizardman.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-lizardman-mire-lizardman_1794035991175_5582ba8a.png",
      "sheet": "sheets/variants/lizardman--mire-lizardman.png",
      "sheetSha256": "6f1d4c9975315339c62282ad656786bbaf16dcf16e167d06b6b3d1b089ba8847",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-lizardman--mire-lizardman-diagonals.png",
      "diagonalSheetSha256": "9493fe61391ad2a97c886867833b0ab4543f15a0fdb8bd15454d6a05dd69ef81",
      "atlas": "atlases/variants/lizardman--mire-lizardman.png",
      "sourceBounds": [
        [
          82,
          87,
          174,
          224
        ],
        [
          89,
          82,
          167,
          224
        ],
        [
          66,
          82,
          191,
          224
        ],
        [
          89,
          82,
          168,
          224
        ],
        [
          89,
          83,
          167,
          224
        ],
        [
          89,
          82,
          168,
          224
        ],
        [
          65,
          82,
          191,
          224
        ],
        [
          89,
          82,
          168,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "lizardman--sunscale-lizardman",
      "name": "Sunscale Lizardman",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "lizardman",
      "identitySource": "archive/art-reference/monsters/humanoid/lizardman/sunscale-lizardman/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-lizardman-sunscale-lizardman.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-lizardman-sunscale-lizardman_1794036015189_59b2f082.png",
      "sheet": "sheets/variants/lizardman--sunscale-lizardman.png",
      "sheetSha256": "d3b6f8683f061c36977b36a1555389d7ae2d651420bed3c7c4d1461f24660ad7",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-lizardman--sunscale-lizardman-diagonals.png",
      "diagonalSheetSha256": "0fda70ad8b018b3b35cddf4501c36264fb2a6a977ba66e5ccd8666569a98963b",
      "atlas": "atlases/variants/lizardman--sunscale-lizardman.png",
      "sourceBounds": [
        [
          88,
          83,
          168,
          224
        ],
        [
          92,
          82,
          165,
          224
        ],
        [
          70,
          86,
          186,
          224
        ],
        [
          93,
          80,
          163,
          224
        ],
        [
          90,
          82,
          167,
          224
        ],
        [
          92,
          82,
          165,
          224
        ],
        [
          70,
          86,
          186,
          224
        ],
        [
          86,
          82,
          171,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "elf--dark-elf",
      "name": "Dark Elf",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "elf",
      "identitySource": "archive/art-reference/monsters/humanoid/elf/dark-elf/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-elf-dark-elf.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-elf-dark-elf_1794036419171_a879e537.png",
      "sheet": "sheets/variants/elf--dark-elf.png",
      "sheetSha256": "d43b0144e8aea200efc00c65e77e6f3135c36e68cd581358c2f29f7a63c9538f",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-elf--dark-elf-diagonals.png",
      "diagonalSheetSha256": "040ec120202300644e9c82fb61cf4bf62ea4d85b482c6bf5816aa70bd5d494bf",
      "atlas": "atlases/variants/elf--dark-elf.png",
      "sourceBounds": [
        [
          73,
          82,
          183,
          224
        ],
        [
          80,
          82,
          176,
          224
        ],
        [
          88,
          85,
          169,
          224
        ],
        [
          82,
          82,
          174,
          224
        ],
        [
          76,
          82,
          181,
          224
        ],
        [
          82,
          82,
          174,
          224
        ],
        [
          88,
          85,
          169,
          224
        ],
        [
          81,
          83,
          176,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "elf--starreader-elf",
      "name": "Starreader Elf",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "elf",
      "identitySource": "archive/art-reference/monsters/humanoid/elf/starreader-elf/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-elf-starreader-elf.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-elf-starreader-elf_1794036437177_9d6125ec.png",
      "sheet": "sheets/variants/elf--starreader-elf.png",
      "sheetSha256": "b08550dcc1b9082a60c8a061cbc1fd0c359871069e778a06994e1103d5ea14f0",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-elf--starreader-elf-diagonals.png",
      "diagonalSheetSha256": "591719eef5455499466674def523f1882ce861e1aac419c4b2b227f4bd892e1a",
      "atlas": "atlases/variants/elf--starreader-elf.png",
      "sourceBounds": [
        [
          75,
          89,
          181,
          224
        ],
        [
          84,
          83,
          172,
          224
        ],
        [
          86,
          82,
          170,
          224
        ],
        [
          82,
          83,
          174,
          224
        ],
        [
          74,
          88,
          182,
          224
        ],
        [
          81,
          81,
          175,
          224
        ],
        [
          86,
          82,
          171,
          224
        ],
        [
          83,
          81,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "giant--hill-giant",
      "name": "Hill Giant",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "giant",
      "identitySource": "archive/art-reference/monsters/humanoid/giant/hill-giant/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-giant-hill-giant.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-giant-hill-giant_1794036466039_50b9040a.png",
      "sheet": "sheets/variants/giant--hill-giant.png",
      "sheetSha256": "e705cae6b13edeef073d8d12917df820b0371280f6cba1169ab212e2b30ea60c",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-giant--hill-giant-diagonals.png",
      "diagonalSheetSha256": "ab210d72662e5cb8b5c71eff7256a93c611d639c2c36807922ca5bf3643d7a02",
      "atlas": "atlases/variants/giant--hill-giant.png",
      "sourceBounds": [
        [
          80,
          90,
          176,
          224
        ],
        [
          79,
          84,
          178,
          224
        ],
        [
          89,
          82,
          168,
          224
        ],
        [
          81,
          84,
          175,
          224
        ],
        [
          82,
          90,
          175,
          224
        ],
        [
          79,
          80,
          177,
          224
        ],
        [
          88,
          82,
          168,
          224
        ],
        [
          79,
          80,
          178,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "giant--peak-giant",
      "name": "Peak Giant",
      "race": "humanoid",
      "kind": "variant",
      "variantOf": "giant",
      "identitySource": "archive/art-reference/monsters/humanoid/giant/peak-giant/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-giant-peak-giant.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-giant-peak-giant_1794036486625_698fbfee.png",
      "sheet": "sheets/variants/giant--peak-giant.png",
      "sheetSha256": "4f9f58f28780fad52ca2835c630aa55238e356f2fa6030b49912df41a50d2c79",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-giant--peak-giant-diagonals.png",
      "diagonalSheetSha256": "e7e37a793dd908b1f6cd68378e45ab5ef3e7e6ce8be77b00193c78d1413277f6",
      "atlas": "atlases/variants/giant--peak-giant.png",
      "sourceBounds": [
        [
          79,
          86,
          177,
          224
        ],
        [
          79,
          82,
          177,
          224
        ],
        [
          90,
          82,
          166,
          224
        ],
        [
          80,
          82,
          176,
          224
        ],
        [
          80,
          86,
          177,
          224
        ],
        [
          80,
          82,
          176,
          224
        ],
        [
          90,
          82,
          166,
          224
        ],
        [
          80,
          82,
          176,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "werewolf--blood-werewolf",
      "name": "Blood Werewolf",
      "race": "beast",
      "kind": "variant",
      "variantOf": "werewolf",
      "identitySource": "archive/art-reference/monsters/beast/werewolf/blood-werewolf/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-werewolf-blood-werewolf.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-werewolf-blood-werewolf_1794036507036_d614a5bd.png",
      "sheet": "sheets/variants/werewolf--blood-werewolf.png",
      "sheetSha256": "8d37e2ab13af0c8092e07bc923365e793313ef43ed097c8e46e3948a4d2ed671",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-werewolf--blood-werewolf-diagonals.png",
      "diagonalSheetSha256": "fdbf70a1fac52bafa02d9c043d8a27f8d09ec390799c2dcaa20accb11e35a04b",
      "atlas": "atlases/variants/werewolf--blood-werewolf.png",
      "sourceBounds": [
        [
          92,
          122,
          165,
          224
        ],
        [
          80,
          124,
          177,
          224
        ],
        [
          66,
          132,
          191,
          224
        ],
        [
          85,
          123,
          172,
          224
        ],
        [
          98,
          122,
          158,
          224
        ],
        [
          82,
          119,
          174,
          224
        ],
        [
          64,
          131,
          192,
          224
        ],
        [
          79,
          121,
          178,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "werewolf--elder-werewolf",
      "name": "Elder Werewolf",
      "race": "beast",
      "kind": "variant",
      "variantOf": "werewolf",
      "identitySource": "archive/art-reference/monsters/beast/werewolf/elder-werewolf/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-werewolf-elder-werewolf.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-werewolf-elder-werewolf_1794036525500_a06298a3.png",
      "sheet": "sheets/variants/werewolf--elder-werewolf.png",
      "sheetSha256": "26c8009c1afaf71ba4bd2283beaec1b2c960095e90e6ca5160a536c6cb235da5",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-werewolf--elder-werewolf-diagonals.png",
      "diagonalSheetSha256": "e5746b61e5297627cb6dc4ca03564e3e3560a7a112c0c69a092f6b2552cf6eaa",
      "atlas": "atlases/variants/werewolf--elder-werewolf.png",
      "sourceBounds": [
        [
          90,
          105,
          166,
          224
        ],
        [
          70,
          104,
          187,
          224
        ],
        [
          54,
          112,
          203,
          224
        ],
        [
          77,
          106,
          179,
          224
        ],
        [
          94,
          107,
          163,
          224
        ],
        [
          77,
          106,
          180,
          224
        ],
        [
          53,
          112,
          203,
          224
        ],
        [
          70,
          104,
          187,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "dryad--verdant-elder-dryad",
      "name": "Verdant Elder Dryad",
      "race": "plant",
      "kind": "variant",
      "variantOf": "dryad",
      "identitySource": "archive/art-reference/monsters/plant/dryad/verdant-elder-dryad/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-dryad-verdant-elder-dryad.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-dryad-verdant-elder-dryad_1794036890503_92062241.png",
      "sheet": "sheets/variants/dryad--verdant-elder-dryad.png",
      "sheetSha256": "b349d88e3c9f9db90f3a5be017f06f8509bd81a7eca2610a2a8aad7ce73ffd98",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-dryad--verdant-elder-dryad-diagonals.png",
      "diagonalSheetSha256": "4146a8570b59051c0c37f8c90a340dbefe4ab3095f677ea221017379b081ca84",
      "atlas": "atlases/variants/dryad--verdant-elder-dryad.png",
      "sourceBounds": [
        [
          88,
          82,
          168,
          224
        ],
        [
          92,
          81,
          165,
          224
        ],
        [
          95,
          88,
          162,
          224
        ],
        [
          92,
          82,
          164,
          224
        ],
        [
          89,
          83,
          167,
          224
        ],
        [
          92,
          83,
          165,
          224
        ],
        [
          95,
          87,
          162,
          224
        ],
        [
          92,
          82,
          165,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "siren--tidal-wave-siren",
      "name": "Tidal Wave Siren",
      "race": "fish",
      "kind": "variant",
      "variantOf": "siren",
      "identitySource": "archive/art-reference/monsters/fish/siren/tidal-wave-siren/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-siren-tidal-wave-siren.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-siren-tidal-wave-siren_1794036913025_2195d807.png",
      "sheet": "sheets/variants/siren--tidal-wave-siren.png",
      "sheetSha256": "e02352aff940960cda49c9546ef27c382720df2c6dad928781a8c0a5ac6b4942",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-siren--tidal-wave-siren-diagonals.png",
      "diagonalSheetSha256": "9a8b5cc0bed407b3a5f291f0b41ea91907e45430e8376beb2c79e6a9a74beb7e",
      "atlas": "atlases/variants/siren--tidal-wave-siren.png",
      "sourceBounds": [
        [
          78,
          82,
          178,
          224
        ],
        [
          82,
          83,
          175,
          224
        ],
        [
          89,
          97,
          167,
          224
        ],
        [
          83,
          82,
          174,
          224
        ],
        [
          78,
          83,
          178,
          224
        ],
        [
          83,
          81,
          174,
          224
        ],
        [
          89,
          97,
          167,
          224
        ],
        [
          81,
          82,
          175,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "siren--abyssal-siren",
      "name": "Abyssal Siren",
      "race": "fish",
      "kind": "variant",
      "variantOf": "siren",
      "identitySource": "archive/art-reference/monsters/fish/siren/abyssal-siren/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-siren-abyssal-siren.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-siren-abyssal-siren_1794037725272_b39e9cdc.png",
      "sheet": "sheets/variants/siren--abyssal-siren.png",
      "sheetSha256": "65b14d088947f2c757f103c031de3c0ae1783e885e5db23bc374b6dd9543b088",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-siren--abyssal-siren-diagonals.png",
      "diagonalSheetSha256": "f62552fb0b0191340e307884d12cdfc32e418e0ab5eae89f1acb4967e02ae300",
      "atlas": "atlases/variants/siren--abyssal-siren.png",
      "sourceBounds": [
        [
          80,
          82,
          177,
          224
        ],
        [
          83,
          83,
          173,
          224
        ],
        [
          88,
          96,
          168,
          224
        ],
        [
          87,
          81,
          169,
          224
        ],
        [
          81,
          82,
          176,
          224
        ],
        [
          88,
          81,
          169,
          224
        ],
        [
          88,
          96,
          168,
          224
        ],
        [
          83,
          83,
          173,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "siren--stormwater-siren",
      "name": "Stormwater Siren",
      "race": "fish",
      "kind": "variant",
      "variantOf": "siren",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-siren-stormwater-siren.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-siren-stormwater-siren_1794036956938_62da23af.png",
      "sheet": "sheets/variants/siren--stormwater-siren.png",
      "sheetSha256": "44e90be188374526c2c1b75a6ea7b1356ec9724cf19ef029bb13febdd28391e6",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-siren--stormwater-siren-diagonals.png",
      "diagonalSheetSha256": "5b0d5155dcf63f3007bf4330216cd0d45140ec6ae944155ab1f9fdea2bdfe947",
      "atlas": "atlases/variants/siren--stormwater-siren.png",
      "sourceBounds": [
        [
          81,
          84,
          175,
          224
        ],
        [
          87,
          84,
          169,
          224
        ],
        [
          89,
          93,
          168,
          224
        ],
        [
          88,
          81,
          169,
          224
        ],
        [
          81,
          82,
          175,
          224
        ],
        [
          88,
          81,
          169,
          224
        ],
        [
          89,
          92,
          168,
          224
        ],
        [
          88,
          83,
          169,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wraith--chain-wraith",
      "name": "Chain Wraith",
      "race": "undead",
      "kind": "variant",
      "variantOf": "wraith",
      "identitySource": "archive/art-reference/monsters/undead/wraith/chain-wraith/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wraith-chain-wraith.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wraith-chain-wraith_1794036973521_65172ebc.png",
      "sheet": "sheets/variants/wraith--chain-wraith.png",
      "sheetSha256": "26c199c16b8a394ecb7081f0d74b56b6611206a89736ba75fb3e2e9244a52721",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wraith--chain-wraith-diagonals.png",
      "diagonalSheetSha256": "a260edbcdd187b68ad236f1d6d797ff3ad0314f43a74c327347fc479d977017b",
      "atlas": "atlases/variants/wraith--chain-wraith.png",
      "sourceBounds": [
        [
          99,
          109,
          157,
          224
        ],
        [
          103,
          108,
          153,
          224
        ],
        [
          105,
          107,
          151,
          224
        ],
        [
          103,
          106,
          154,
          224
        ],
        [
          100,
          108,
          157,
          224
        ],
        [
          104,
          106,
          153,
          224
        ],
        [
          104,
          107,
          152,
          224
        ],
        [
          103,
          108,
          153,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wraith--dread-wraith",
      "name": "Dread Wraith",
      "race": "undead",
      "kind": "variant",
      "variantOf": "wraith",
      "identitySource": "archive/art-reference/monsters/undead/wraith/dread-wraith/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wraith-dread-wraith.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wraith-dread-wraith_1794037000560_4be024c6.png",
      "sheet": "sheets/variants/wraith--dread-wraith.png",
      "sheetSha256": "5e1325b3907aeee42660ad8b80548df6582426806d5325f1fb463c3c8cab9baa",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wraith--dread-wraith-diagonals.png",
      "diagonalSheetSha256": "4d5256a08dbc2b259e18796dde01e532175cfe900a35567a2045b1dd0f39516f",
      "atlas": "atlases/variants/wraith--dread-wraith.png",
      "sourceBounds": [
        [
          92,
          106,
          164,
          224
        ],
        [
          97,
          106,
          159,
          224
        ],
        [
          99,
          110,
          157,
          224
        ],
        [
          98,
          106,
          159,
          224
        ],
        [
          91,
          106,
          166,
          224
        ],
        [
          97,
          106,
          159,
          224
        ],
        [
          99,
          109,
          158,
          224
        ],
        [
          97,
          106,
          159,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wraith--hollow-wraith",
      "name": "Hollow Wraith",
      "race": "undead",
      "kind": "variant",
      "variantOf": "wraith",
      "identitySource": "archive/art-reference/monsters/undead/wraith/hollow-wraith/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wraith-hollow-wraith.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wraith-hollow-wraith_1794037023790_e8558b48.png",
      "sheet": "sheets/variants/wraith--hollow-wraith.png",
      "sheetSha256": "5c57c7f12afb2f64da7624581580c12518a693538da094afd31e01be8147a1e1",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wraith--hollow-wraith-diagonals.png",
      "diagonalSheetSha256": "467bdeba6822844cc052399661142dbae35d6522c73ef1e2db5a83bd1445f887",
      "atlas": "atlases/variants/wraith--hollow-wraith.png",
      "sourceBounds": [
        [
          91,
          90,
          166,
          224
        ],
        [
          93,
          82,
          163,
          224
        ],
        [
          97,
          82,
          160,
          224
        ],
        [
          93,
          82,
          164,
          224
        ],
        [
          92,
          89,
          165,
          224
        ],
        [
          93,
          82,
          163,
          224
        ],
        [
          96,
          82,
          160,
          224
        ],
        [
          94,
          83,
          162,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "imp--pinch-imp",
      "name": "Pinch Imp",
      "race": "demon",
      "kind": "variant",
      "variantOf": "imp",
      "identitySource": "archive/art-reference/monsters/demon/imp/pinch-imp/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-imp-pinch-imp.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-imp-pinch-imp_1794037382038_365196f7.png",
      "sheet": "sheets/variants/imp--pinch-imp.png",
      "sheetSha256": "9f46c0520d325e50b787543ff7d9e0b4438dee34c260c4851ec17d96b310aa0a",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-imp--pinch-imp-diagonals.png",
      "diagonalSheetSha256": "bbd6c806e5b8a9425313d31bb419f4f723bf41bc2a649521f453815a9e2c70aa",
      "atlas": "atlases/variants/imp--pinch-imp.png",
      "sourceBounds": [
        [
          79,
          120,
          177,
          224
        ],
        [
          84,
          104,
          173,
          224
        ],
        [
          86,
          119,
          171,
          224
        ],
        [
          85,
          102,
          171,
          224
        ],
        [
          77,
          103,
          179,
          224
        ],
        [
          85,
          102,
          171,
          224
        ],
        [
          86,
          118,
          171,
          224
        ],
        [
          86,
          105,
          171,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "imp--hornling-imp",
      "name": "Hornling Imp",
      "race": "demon",
      "kind": "variant",
      "variantOf": "imp",
      "identitySource": "archive/art-reference/monsters/demon/imp/hornling-imp/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-imp-hornling-imp.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-imp-hornling-imp_1794037746736_034da6ac.png",
      "sheet": "sheets/variants/imp--hornling-imp.png",
      "sheetSha256": "c1abd18d390e648db7a4a72f786e1e2336de0f3af07d285ed68a91e3853a61ff",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-imp--hornling-imp-diagonals.png",
      "diagonalSheetSha256": "430fbf99107cab06d5f3882f0e0e07614331c641206e03ea37c9ab3f24c1a44a",
      "atlas": "atlases/variants/imp--hornling-imp.png",
      "sourceBounds": [
        [
          73,
          95,
          184,
          224
        ],
        [
          74,
          83,
          182,
          224
        ],
        [
          82,
          91,
          174,
          224
        ],
        [
          73,
          81,
          183,
          224
        ],
        [
          59,
          82,
          198,
          224
        ],
        [
          73,
          81,
          183,
          224
        ],
        [
          81,
          92,
          175,
          224
        ],
        [
          75,
          85,
          182,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wyvern--shriek-wyvern",
      "name": "Shriek Wyvern",
      "race": "dragon",
      "kind": "variant",
      "variantOf": "wyvern",
      "identitySource": "archive/art-reference/monsters/dragon/wyvern/shriek-wyvern/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wyvern-shriek-wyvern.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wyvern-shriek-wyvern_1794037434400_6c464d10.png",
      "sheet": "sheets/variants/wyvern--shriek-wyvern.png",
      "sheetSha256": "665add0660d81a188cfc55e8387d7027fb09ee74061aea3a7360699d00b3c4db",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wyvern--shriek-wyvern-diagonals.png",
      "diagonalSheetSha256": "80adb3133b9c19b0681eb889fd34607fcd1af510793891e9bcbc48b4cad99070",
      "atlas": "atlases/variants/wyvern--shriek-wyvern.png",
      "sourceBounds": [
        [
          80,
          124,
          177,
          224
        ],
        [
          80,
          119,
          177,
          224
        ],
        [
          69,
          126,
          188,
          224
        ],
        [
          83,
          118,
          173,
          224
        ],
        [
          81,
          120,
          176,
          224
        ],
        [
          82,
          121,
          174,
          224
        ],
        [
          68,
          125,
          189,
          224
        ],
        [
          79,
          122,
          177,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wyvern--elder-wyvern",
      "name": "Elder Wyvern",
      "race": "dragon",
      "kind": "variant",
      "variantOf": "wyvern",
      "identitySource": "archive/art-reference/monsters/dragon/wyvern/elder-wyvern/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wyvern-elder-wyvern.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wyvern-elder-wyvern_1794037451743_2c72bec0.png",
      "sheet": "sheets/variants/wyvern--elder-wyvern.png",
      "sheetSha256": "a8243e87efebc2b65bdea4f0faf76e58f6cb832ca563ad44e7f542f3880b19d8",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wyvern--elder-wyvern-diagonals.png",
      "diagonalSheetSha256": "bbb09d1484bdd51f869c6fec987d427edb5382ccd77ee8766acc0a68cdb805e0",
      "atlas": "atlases/variants/wyvern--elder-wyvern.png",
      "sourceBounds": [
        [
          65,
          123,
          191,
          224
        ],
        [
          67,
          110,
          189,
          224
        ],
        [
          64,
          122,
          193,
          224
        ],
        [
          67,
          106,
          189,
          224
        ],
        [
          60,
          108,
          197,
          224
        ],
        [
          67,
          105,
          189,
          224
        ],
        [
          65,
          122,
          192,
          224
        ],
        [
          67,
          110,
          189,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "beetle--meadow-beetle",
      "name": "Meadow Beetle",
      "race": "insect",
      "kind": "variant",
      "variantOf": "beetle",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-beetle-meadow-beetle.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-beetle-meadow-beetle_1794037472264_0ece7107.png",
      "sheet": "sheets/variants/beetle--meadow-beetle.png",
      "sheetSha256": "10789c0c3b29e2f1ce09180313f9e03bc7694500360e11445b4130f01382bcb3",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-beetle--meadow-beetle-diagonals.png",
      "diagonalSheetSha256": "f3dba6bc46e45ef53882e0b9eb608b467b17f6e35a1eb8324aeefd8750ba7a82",
      "atlas": "atlases/variants/beetle--meadow-beetle.png",
      "sourceBounds": [
        [
          54,
          113,
          202,
          224
        ],
        [
          54,
          114,
          202,
          224
        ],
        [
          54,
          143,
          202,
          224
        ],
        [
          54,
          111,
          203,
          224
        ],
        [
          56,
          123,
          201,
          224
        ],
        [
          53,
          112,
          204,
          224
        ],
        [
          53,
          142,
          203,
          224
        ],
        [
          55,
          116,
          202,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "beetle--carapace-beetle",
      "name": "Carapace Beetle",
      "race": "insect",
      "kind": "variant",
      "variantOf": "beetle",
      "identitySource": "archive/art-reference/monsters/insect/beetle/carapace-beetle/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-beetle-carapace-beetle.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-beetle-carapace-beetle_1794037770321_df043957.png",
      "sheet": "sheets/variants/beetle--carapace-beetle.png",
      "sheetSha256": "b76867b12a61a2abc3326403a0e3ae9148e2b9136b55cb32185a2a379c4d0bb3",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-beetle--carapace-beetle-diagonals.png",
      "diagonalSheetSha256": "5e34d195dfd3780ac90dea32ba09305331b5887a9ccbcde87898e9edacba86ba",
      "atlas": "atlases/variants/beetle--carapace-beetle.png",
      "sourceBounds": [
        [
          64,
          126,
          192,
          224
        ],
        [
          69,
          127,
          188,
          224
        ],
        [
          63,
          148,
          194,
          224
        ],
        [
          66,
          124,
          191,
          224
        ],
        [
          65,
          136,
          192,
          224
        ],
        [
          65,
          130,
          191,
          224
        ],
        [
          60,
          148,
          196,
          224
        ],
        [
          69,
          125,
          188,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "beetle--hollow-beetle",
      "name": "Hollow Beetle",
      "race": "insect",
      "kind": "variant",
      "variantOf": "beetle",
      "identitySource": "archive/art-reference/monsters/insect/beetle/hollow-beetle/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-beetle-hollow-beetle.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-beetle-hollow-beetle_1794038108484_33351940.png",
      "sheet": "sheets/variants/beetle--hollow-beetle.png",
      "sheetSha256": "ff270e148c476b0ece02f0fb43ab903a313bd1c7c6ce67eb6debfd8bd5431dc1",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-beetle--hollow-beetle-diagonals.png",
      "diagonalSheetSha256": "9af11d60ef177c7a3559d9c0cf4f42e4619eb63fb7774b343ecfe78a4c55c917",
      "atlas": "atlases/variants/beetle--hollow-beetle.png",
      "sourceBounds": [
        [
          56,
          125,
          201,
          224
        ],
        [
          67,
          120,
          190,
          224
        ],
        [
          53,
          139,
          203,
          224
        ],
        [
          68,
          130,
          189,
          224
        ],
        [
          58,
          127,
          198,
          224
        ],
        [
          69,
          131,
          188,
          224
        ],
        [
          55,
          140,
          202,
          224
        ],
        [
          68,
          119,
          188,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "hornet--meadow-hornet",
      "name": "Meadow Hornet",
      "race": "insect",
      "kind": "variant",
      "variantOf": "hornet",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-hornet-meadow-hornet.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-hornet-meadow-hornet_1794037814742_73e9c008.png",
      "sheet": "sheets/variants/hornet--meadow-hornet.png",
      "sheetSha256": "55774dffdfa1882943062771dfbecb2dbd7e1f0c1918986b02e018102599709e",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-hornet--meadow-hornet-diagonals.png",
      "diagonalSheetSha256": "3eecc10f2e32cd60256cbe459dec634b2e9dfe3f5c08db0a542a42c74e6b29fc",
      "atlas": "atlases/variants/hornet--meadow-hornet.png",
      "sourceBounds": [
        [
          53,
          110,
          203,
          224
        ],
        [
          64,
          112,
          192,
          224
        ],
        [
          57,
          139,
          199,
          224
        ],
        [
          68,
          108,
          188,
          224
        ],
        [
          58,
          113,
          199,
          224
        ],
        [
          70,
          110,
          186,
          224
        ],
        [
          57,
          139,
          200,
          224
        ],
        [
          65,
          110,
          192,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "hornet--bog-hornet",
      "name": "Bog Hornet",
      "race": "insect",
      "kind": "variant",
      "variantOf": "hornet",
      "identitySource": "archive/art-reference/monsters/insect/hornet/bog-hornet/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-hornet-bog-hornet.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-hornet-bog-hornet_1794037833288_69ec307b.png",
      "sheet": "sheets/variants/hornet--bog-hornet.png",
      "sheetSha256": "a337f64461e72cf232fffbff6347f23a914cd6672d1852fb470fd26327436e47",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-hornet--bog-hornet-diagonals.png",
      "diagonalSheetSha256": "e085ae547a48d82a05c1ad1fb1c0ad7a37853ccba81a20e4f99410f962c844f3",
      "atlas": "atlases/variants/hornet--bog-hornet.png",
      "sourceBounds": [
        [
          60,
          123,
          196,
          224
        ],
        [
          74,
          106,
          182,
          224
        ],
        [
          63,
          123,
          193,
          224
        ],
        [
          70,
          111,
          187,
          224
        ],
        [
          53,
          110,
          203,
          224
        ],
        [
          76,
          115,
          181,
          224
        ],
        [
          64,
          124,
          193,
          224
        ],
        [
          73,
          109,
          183,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "hornet--vespa-hornet",
      "name": "Vespa Hornet",
      "race": "insect",
      "kind": "variant",
      "variantOf": "hornet",
      "identitySource": "archive/art-reference/monsters/insect/hornet/vespa-hornet/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-hornet-vespa-hornet.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-hornet-vespa-hornet_1794037854146_a53a09c2.png",
      "sheet": "sheets/variants/hornet--vespa-hornet.png",
      "sheetSha256": "c24c3c76aa5ec6465b9fef7d06971c99e1d11e1b1d6a775081e639c1b46bba36",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-hornet--vespa-hornet-diagonals.png",
      "diagonalSheetSha256": "766d2976405480e6d62927b967d2c175b1160043d4d888e9566623f28d13438d",
      "atlas": "atlases/variants/hornet--vespa-hornet.png",
      "sourceBounds": [
        [
          54,
          119,
          203,
          224
        ],
        [
          71,
          108,
          186,
          224
        ],
        [
          64,
          112,
          192,
          224
        ],
        [
          70,
          113,
          186,
          224
        ],
        [
          53,
          111,
          203,
          224
        ],
        [
          69,
          115,
          188,
          224
        ],
        [
          64,
          111,
          192,
          224
        ],
        [
          70,
          109,
          186,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "hornet--queenling-hornet",
      "name": "Queenling Hornet",
      "race": "insect",
      "kind": "variant",
      "variantOf": "hornet",
      "identitySource": "archive/art-reference/monsters/insect/hornet/queenling-hornet/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-hornet-queenling-hornet.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-hornet-queenling-hornet_1794037874318_cc2b990d.png",
      "sheet": "sheets/variants/hornet--queenling-hornet.png",
      "sheetSha256": "7bb7cd740279cb2563d1f8499451f5fca1e3a7e479504f700a73e119ef3b2bb2",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-hornet--queenling-hornet-diagonals.png",
      "diagonalSheetSha256": "17d6bf8df105a1ee42fcfc2da20e16a1c03c02743b66ad7c68c0f46e67dbd2df",
      "atlas": "atlases/variants/hornet--queenling-hornet.png",
      "sourceBounds": [
        [
          57,
          106,
          200,
          224
        ],
        [
          73,
          99,
          184,
          224
        ],
        [
          53,
          97,
          203,
          224
        ],
        [
          69,
          96,
          188,
          224
        ],
        [
          57,
          100,
          200,
          224
        ],
        [
          84,
          96,
          173,
          224
        ],
        [
          57,
          97,
          199,
          224
        ],
        [
          74,
          98,
          183,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ooze--mire-ooze",
      "name": "Mire Ooze",
      "race": "formless",
      "kind": "variant",
      "variantOf": "ooze",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-ooze-mire-ooze.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ooze-mire-ooze_1794038125974_97523bdd.png",
      "sheet": "sheets/variants/ooze--mire-ooze.png",
      "sheetSha256": "75f67ea087c522d49f89158478cb3cd514408275abadec6d25682c21c8c3858f",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ooze--mire-ooze-diagonals.png",
      "diagonalSheetSha256": "b9d52a7c5849cc86916bd4cbb6ef5abd2b69f11e6e024857e2f57f1efce57c9b",
      "atlas": "atlases/variants/ooze--mire-ooze.png",
      "sourceBounds": [
        [
          53,
          82,
          203,
          224
        ],
        [
          59,
          83,
          197,
          224
        ],
        [
          61,
          84,
          196,
          224
        ],
        [
          60,
          83,
          196,
          224
        ],
        [
          55,
          83,
          202,
          224
        ],
        [
          57,
          81,
          199,
          224
        ],
        [
          58,
          84,
          198,
          224
        ],
        [
          58,
          81,
          199,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ooze--silt-ooze",
      "name": "Silt Ooze",
      "race": "formless",
      "kind": "variant",
      "variantOf": "ooze",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-ooze-silt-ooze.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ooze-silt-ooze_1794038146223_54dc78a6.png",
      "sheet": "sheets/variants/ooze--silt-ooze.png",
      "sheetSha256": "949a4cb707c8270e273aca0e4ef6026a828ee9055f47ab29b04b59127fc9d586",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ooze--silt-ooze-diagonals.png",
      "diagonalSheetSha256": "87ed53c15e288cc655c33fa31faea7e073b15bccf670cf097afa05126d34e857",
      "atlas": "atlases/variants/ooze--silt-ooze.png",
      "sourceBounds": [
        [
          58,
          91,
          199,
          224
        ],
        [
          62,
          88,
          194,
          224
        ],
        [
          54,
          87,
          203,
          224
        ],
        [
          67,
          89,
          189,
          224
        ],
        [
          58,
          91,
          198,
          224
        ],
        [
          64,
          86,
          193,
          224
        ],
        [
          53,
          87,
          203,
          224
        ],
        [
          63,
          85,
          193,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ooze--vat-ooze",
      "name": "Vat Ooze",
      "race": "formless",
      "kind": "variant",
      "variantOf": "ooze",
      "identitySource": "archive/art-reference/monsters/formless/ooze/vat-ooze/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-ooze-vat-ooze.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ooze-vat-ooze_1794038166593_280af237.png",
      "sheet": "sheets/variants/ooze--vat-ooze.png",
      "sheetSha256": "9b5b6e6d183566c67780862834dc893a8c707c06d448e81a4293a413adb74c9b",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ooze--vat-ooze-diagonals.png",
      "diagonalSheetSha256": "6716912a47e6228e0e24ebb45bba9049f31a09b30c9567c61b7a67690dd76b7f",
      "atlas": "atlases/variants/ooze--vat-ooze.png",
      "sourceBounds": [
        [
          54,
          101,
          203,
          224
        ],
        [
          54,
          100,
          203,
          224
        ],
        [
          58,
          100,
          199,
          224
        ],
        [
          56,
          99,
          200,
          224
        ],
        [
          53,
          102,
          203,
          224
        ],
        [
          55,
          101,
          202,
          224
        ],
        [
          58,
          102,
          199,
          224
        ],
        [
          56,
          100,
          201,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "ooze--blight-ooze",
      "name": "Blight Ooze",
      "race": "formless",
      "kind": "variant",
      "variantOf": "ooze",
      "identitySource": null,
      "identityKind": "none",
      "board": "docs/art-reference/pawn-study/sources/variant-ooze-blight-ooze.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-ooze-blight-ooze_1794038183544_90d0f268.png",
      "sheet": "sheets/variants/ooze--blight-ooze.png",
      "sheetSha256": "60d44cb729bac5db05e68164c744a15f5d2168c974ae12c02a2a8bcff6aba6c8",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-ooze--blight-ooze-diagonals.png",
      "diagonalSheetSha256": "75e49f519e73b8b8a972faf0c1ec8e78a0a89087539fb56e1bce0ff68de7126c",
      "atlas": "atlases/variants/ooze--blight-ooze.png",
      "sourceBounds": [
        [
          60,
          83,
          196,
          224
        ],
        [
          62,
          82,
          194,
          224
        ],
        [
          65,
          82,
          192,
          224
        ],
        [
          66,
          81,
          190,
          224
        ],
        [
          60,
          82,
          196,
          224
        ],
        [
          63,
          83,
          193,
          224
        ],
        [
          63,
          82,
          194,
          224
        ],
        [
          64,
          82,
          193,
          224
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wisp--arc-wisp",
      "name": "Arc Wisp",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "wisp",
      "identitySource": "archive/art-reference/monsters/elemental/wisp/arc-wisp/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wisp-arc-wisp.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wisp-arc-wisp_1794038201575_3c476b05.png",
      "sheet": "sheets/variants/wisp--arc-wisp.png",
      "sheetSha256": "1995404c27d81c67df1972f540e098dc9223749713f223b73829bf870a2c4388",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wisp--arc-wisp-diagonals.png",
      "diagonalSheetSha256": "c697aeb8f48044638c51505f2f6657757bfd22e3fd5133d21fb736f3ea5290ed",
      "atlas": "atlases/variants/wisp--arc-wisp.png",
      "sourceBounds": [
        [
          107,
          47,
          435,
          414
        ],
        [
          154,
          126,
          426,
          467
        ],
        [
          87,
          18,
          406,
          383
        ],
        [
          197,
          126,
          451,
          467
        ],
        [
          77,
          46,
          401,
          412
        ],
        [
          168,
          110,
          428,
          451
        ],
        [
          98,
          20,
          419,
          381
        ],
        [
          196,
          104,
          462,
          450
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "harpy--harpy-screecher",
      "name": "Harpy Screecher",
      "race": "beast",
      "kind": "variant",
      "variantOf": "harpy",
      "identitySource": "archive/art-reference/monsters/beast/harpy/harpy-screecher/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-harpy-harpy-screecher.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-harpy-harpy-screecher_1794038223080_946fa89e.png",
      "sheet": "sheets/variants/harpy--harpy-screecher.png",
      "sheetSha256": "690a0eea23856766e5fc2db4c11c85716fb1d2050a5af1c25eedeffdee52a617",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-harpy--harpy-screecher-diagonals.png",
      "diagonalSheetSha256": "189bac9a7457893819d458c4d39be293ac13895249127b4236dcfaed012b7951",
      "atlas": "atlases/variants/harpy--harpy-screecher.png",
      "sourceBounds": [
        [
          145,
          37,
          371,
          464
        ],
        [
          193,
          133,
          386,
          516
        ],
        [
          96,
          23,
          332,
          406
        ],
        [
          236,
          127,
          420,
          516
        ],
        [
          120,
          42,
          337,
          464
        ],
        [
          202,
          74,
          395,
          471
        ],
        [
          145,
          22,
          385,
          406
        ],
        [
          242,
          72,
          446,
          471
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "bonehound--bone-hound-gnawer",
      "name": "Bone Hound Gnawer",
      "race": "undead",
      "kind": "variant",
      "variantOf": "bonehound",
      "identitySource": "archive/art-reference/monsters/undead/bonehound/bone-hound-gnawer/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-bonehound-bone-hound-gnawer.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-bonehound-bone-hound-gnawer_1794038518035_335a60bf.png",
      "sheet": "sheets/variants/bonehound--bone-hound-gnawer.png",
      "sheetSha256": "8a5351f10b7e5417702b7b904afba6a3170516bbea5e4c9ebd98d89af78e6c70",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-bonehound--bone-hound-gnawer-diagonals.png",
      "diagonalSheetSha256": "a6badfaca8ef9509694c2001e77c8c6ae5929c35b7f822dacc2ae7b45c795b0a",
      "atlas": "atlases/variants/bonehound--bone-hound-gnawer.png",
      "sourceBounds": [
        [
          131,
          140,
          390,
          419
        ],
        [
          133,
          203,
          437,
          464
        ],
        [
          13,
          119,
          478,
          338
        ],
        [
          196,
          183,
          469,
          464
        ],
        [
          135,
          140,
          359,
          418
        ],
        [
          159,
          156,
          444,
          433
        ],
        [
          28,
          118,
          490,
          338
        ],
        [
          189,
          177,
          489,
          434
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "revenant--frost-revenant-warden",
      "name": "Frost Revenant Warden",
      "race": "undead",
      "kind": "variant",
      "variantOf": "revenant",
      "identitySource": "archive/art-reference/monsters/undead/revenant/frost-revenant-warden/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-revenant-frost-revenant-warden.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-revenant-frost-revenant-warden_1794038537473_1a631e2e.png",
      "sheet": "sheets/variants/revenant--frost-revenant-warden.png",
      "sheetSha256": "f2f111f9e9189fbe45e5e4b7e1038a5ed3f076a9f60608934ad8390fb0087c88",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-revenant--frost-revenant-warden-diagonals.png",
      "diagonalSheetSha256": "cabf65bdb90105469957b0f16eac428a936d7a4cfdf3aff2ba089b7588929667",
      "atlas": "atlases/variants/revenant--frost-revenant-warden.png",
      "sourceBounds": [
        [
          155,
          64,
          365,
          418
        ],
        [
          181,
          116,
          388,
          513
        ],
        [
          147,
          27,
          319,
          380
        ],
        [
          222,
          113,
          414,
          512
        ],
        [
          140,
          61,
          349,
          430
        ],
        [
          216,
          93,
          408,
          490
        ],
        [
          179,
          26,
          352,
          381
        ],
        [
          238,
          93,
          447,
          491
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "mirehydra--mire-hydra-broodling",
      "name": "Mire Hydra Broodling",
      "race": "dragon",
      "kind": "variant",
      "variantOf": "mirehydra",
      "identitySource": "archive/art-reference/monsters/dragon/mirehydra/mire-hydra-broodling/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-mirehydra-mire-hydra-broodling.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-mirehydra-mire-hydra-broodling_1794038555699_7575a2f6.png",
      "sheet": "sheets/variants/mirehydra--mire-hydra-broodling.png",
      "sheetSha256": "defa4b5240cb56ef349eceebbf61ef943b08646d2439fd7bfe4577d757cdcaa4",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-mirehydra--mire-hydra-broodling-diagonals.png",
      "diagonalSheetSha256": "70b1152746646e31440cb5290f82dad7a437b3f07e941fcd8e0548875a3baade",
      "atlas": "atlases/variants/mirehydra--mire-hydra-broodling.png",
      "sourceBounds": [
        [
          101,
          72,
          406,
          386
        ],
        [
          119,
          121,
          499,
          485
        ],
        [
          48,
          58,
          432,
          385
        ],
        [
          164,
          114,
          478,
          486
        ],
        [
          116,
          80,
          389,
          420
        ],
        [
          148,
          107,
          473,
          483
        ],
        [
          72,
          59,
          449,
          385
        ],
        [
          129,
          104,
          502,
          474
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "slaggolem--slag-golem-crusher",
      "name": "Slag Golem Crusher",
      "race": "elemental",
      "kind": "variant",
      "variantOf": "slaggolem",
      "identitySource": "archive/art-reference/monsters/elemental/slaggolem/slag-golem-crusher/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-slaggolem-slag-golem-crusher.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-slaggolem-slag-golem-crusher_1794038576826_8d5fd87c.png",
      "sheet": "sheets/variants/slaggolem--slag-golem-crusher.png",
      "sheetSha256": "4fca7700c307f20018ccaea7f3d14936ab5e5307b032dd8b93f5188e14793706",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-slaggolem--slag-golem-crusher-diagonals.png",
      "diagonalSheetSha256": "d81342d1c99d334abfa7b0867b2804263aa017085aa683844eff6c5bacdd5ffa",
      "atlas": "atlases/variants/slaggolem--slag-golem-crusher.png",
      "sourceBounds": [
        [
          100,
          55,
          417,
          449
        ],
        [
          163,
          106,
          452,
          497
        ],
        [
          127,
          56,
          378,
          434
        ],
        [
          179,
          104,
          460,
          498
        ],
        [
          94,
          55,
          411,
          447
        ],
        [
          167,
          104,
          452,
          497
        ],
        [
          123,
          56,
          373,
          434
        ],
        [
          174,
          103,
          459,
          497
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    },
    {
      "id": "wyrmling--wyrmling-scaler",
      "name": "Wyrmling Scaler",
      "race": "dragon",
      "kind": "variant",
      "variantOf": "wyrmling",
      "identitySource": "archive/art-reference/monsters/dragon/wyrmling/wyrmling-scaler/atlas/animation-draft.png",
      "identityKind": "atlas-front",
      "board": "docs/art-reference/pawn-study/sources/variant-wyrmling-wyrmling-scaler.jpg",
      "generatedSource": "docs/art-reference/pawn-study/generation/pawn-variant-wyrmling-wyrmling-scaler_1794038596079_e7901467.png",
      "sheet": "sheets/variants/wyrmling--wyrmling-scaler.png",
      "sheetSha256": "8c69210eeb36a1e919a3d2214ebe287ff50bb7d1665df336e9f66b86a113353a",
      "diagonalSheet": "docs/art-reference/pawn-study/generation/eight-direction/pawn-wyrmling--wyrmling-scaler-diagonals.png",
      "diagonalSheetSha256": "a4a296ade00fe4e80f3016a35046c29517c1d4507a013a3f801093a57e225cf6",
      "atlas": "atlases/variants/wyrmling--wyrmling-scaler.png",
      "sourceBounds": [
        [
          116,
          92,
          392,
          442
        ],
        [
          155,
          186,
          430,
          499
        ],
        [
          46,
          74,
          422,
          403
        ],
        [
          185,
          166,
          436,
          501
        ],
        [
          118,
          92,
          376,
          443
        ],
        [
          180,
          142,
          431,
          467
        ],
        [
          71,
          71,
          447,
          404
        ],
        [
          192,
          152,
          463,
          467
        ]
      ],
      "layout": {
        "columns": 4,
        "rows": 2,
        "frameCount": 8,
        "directions": [
          "south",
          "south-east",
          "east",
          "north-east",
          "north",
          "north-west",
          "west",
          "south-west"
        ]
      },
      "productionApproved": true
    }
  ]
};
