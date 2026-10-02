# Adding questions

Choose these four things before writing a question:

1. **Category:** the main section, such as Lower extremity or Diseases & pathology.
2. **Subcategory:** the body part or topic, such as Ankle or Abdominal conditions.
3. **Projection or condition:** the specific view, named method, or condition being tested.
4. **Focus:** what the student should recall, such as central ray, evaluation criteria, or pathology terminology.

The builder follows this order. For pathology, it shows condition names and hides the projection-family menu.

## Where each choice comes from

| File or field | Purpose |
| --- | --- |
| `data/groups.json` | Main categories and their question-file paths |
| `data/projections.json` | Subcategories and their available projections or conditions |
| `data/focuses.json` | Focus choices |
| `part` on a question | The subcategory ID from `projections.json` |
| `projectionId` on a question | The specific view or condition ID within that subcategory |
| `projection` on a question | Its readable view or condition name |
| `topic` on a question | The focus ID from `focuses.json` |

There is one shared subcategory catalog. The study filters and question builder use the same entries, so a new subcategory does not need to be added to several menus.

## Lower extremity

These are the current `part` IDs:

| ID | Subcategory | Questions |
| --- | --- | ---: |
| `toes` | Toes | 21 |
| `sesamoids` | Sesamoids | 9 |
| `foot` | Foot | 40 |
| `ankle` | Ankle | 31 |
| `calcaneus` | Calcaneus | 10 |
| `leg` | Lower leg / tibia & fibula | 14 |

For future positioning questions, work through one projection at a time. Cover the CR entrance point and angle, purpose, distinguishing positioning details, unique evaluation criteria, and IR/collimation where the supplied material supports them. Add an image question when it tests something students can identify in that image.

Keep named methods and variants separate. For example, ankle mortise and the 45° medial oblique have separate projection IDs even though both are oblique views. Sesamoid views now have their own subcategory; existing Holly and Lewis IDs remain valid.

## Diseases & pathology

| ID | Subcategory | Questions |
| --- | --- | ---: |
| `respiratory` | Chest & respiratory conditions | 26 |
| `abdominal` | Abdominal conditions | 5 |
| `bone-joint` | Bone, joint & soft tissue conditions | 12 |
| `tumors` | Tumors & neoplasms | 10 |
| `fractures-dislocations` | Fractures & dislocations | 15 |
| `developmental` | Developmental & childhood conditions | 5 |
| `spine` | Spinal conditions | 9 |

All supplied conditions remain in this bank, including fractures and dislocations. There is no separate Injuries & trauma category. The catalog lists each supplied condition so it can be selected in the builder without typing its name again.

## Question files

Keep each category file as a JSON array. Its file determines the category; each question's `part` determines the subcategory. The example below shows an existing question's structure:

```json
[
  {
    "id": "lower-001",
    "part": "toes",
    "projectionId": "toes-ap",
    "projection": "AP toes",
    "topic": "central-ray",
    "type": "mcq",
    "prompt": "Where is the CR centered for an AP projection of the toes?",
    "options": [
      "Base of the third metatarsal",
      "Third MTP joint",
      "First MTP joint",
      "Proximal IP joint of the third toe"
    ],
    "answer": "Third MTP joint",
    "explanation": "The AP toes projection uses a perpendicular CR centered at the third MTP joint.",
    "source": "Positioning practice · AP toes"
  }
]
```

Use a new, unique question ID for a new question. Keep existing IDs when reorganizing a bank so saved progress stays attached to the same cards. The correct answer must exactly match one option. Use `short` questions mainly for answers with limited wording, such as a single number or joint name; add `acceptedAnswers` for reasonable alternatives.

Optional images use the existing format:

```json
"image": {
  "src": "images/example.png",
  "alt": "A description of what is visible",
  "caption": "Optional caption"
}
```

Keep existing image paths unchanged unless the file itself moves. Reordering questions or changing their subcategory does not reset progress. Changing a question's prompt or answer starts fresh answer statistics while keeping its learned mark and bookmark.

## Adding a subcategory

In the builder, open **Add a category, subcategory or focus**. Choose the parent category, then enter a new subcategory name. It is saved with your personal questions and included in the question backup.

For a shared subcategory, add an entry to `data/projections.json` with an `id`, `name`, `group`, `kind`, and `views` array. Use `kind: "projection"` for positioning views or `kind: "topic"` for subjects such as pathology. Each view has an `id`, `orientation`, `label`, and optional `detail`. Topic entries use `orientation: "Topic"`.

A subcategory with an empty `views` array still appears in the builder and lets an author enter an unlisted topic. Existing questions without subcategory metadata remain accessible under an inferred part or General / not assigned.

## When generating another batch

Provide the source material, category, subcategory, and projection or condition IDs. Specify the focuses and number of questions you want. Ask for the existing JSON format, unique IDs, mostly multiple-choice questions, and no invented projections, methods, or unsupported facts.

Import the current category file before adding questions in the builder. Exporting a category produces the whole category file, including all its subcategories. Replace the matching category JSON in the website only after checking that the questions you want to keep are included.
