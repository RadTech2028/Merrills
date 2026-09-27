# Positioning Lab

A standalone positioning study app for Connor Kelly and classmates. No books.json, accounts, database, npm installation, or build step required. Content is grouped by anatomy.

## Try the sample

The bank contains 21 sample questions from the four supplied study guides. Includes multiple choice, a short answer example, and one image question with a simple 45° schematic. It is not a comprehensive question bank and has not been independently checked against a Merrill’s edition.

Select groups and focus areas, choose practice, test, or flashcards, then start. Practice gives explanations immediately. Test holds feedback until results. Flashcards use self-assessment. Results let you retry missed questions. Question Bank provides searchable reference answers.

## Put it on GitHub Pages

To keep your current website intact:

1. Unzip this package.
2. Create a folder named positioning in your RT2026-practice-terms repository.
3. Upload the entire package contents into that folder, preserving the data and images folders. index.html must be directly inside positioning.
4. Commit the files. Your existing GitHub Pages deployment will publish them.
5. Open https://radtech2028.github.io/RT2026-practice-terms/positioning/

Alternatively, place the package contents at the root of a new repository and enable GitHub Pages from that branch in its Pages settings. All app paths are relative, so the app works under a repository subpath.

To test locally, run "python3 -m http.server 8000" from this folder and open http://localhost:8000. Opening index.html directly with a file:// URL does not allow JSON loading in most browsers.

The private preview supplied in ChatGPT is separate from GitHub. Your existing GitHub repository has not been changed.

## Files

- index.html: app layout
- styles.css: visual styling and responsive layout
- app.js: study modes, validation, import, export, and builder
- data/groups.json: group menu
- data/hands.json, wrist.json, shoulder.json, lower.json: question arrays
- images/: your radiographs, diagrams, or positioning photos
- favicon.svg: app icon

## Easiest way to add questions

1. Open Question builder and select an anatomy group.
2. Import that group's CURRENT JSON file first if you want to preserve its published questions.
3. Add or edit questions, with optional images and explanations.
4. Use Try this draft group to preview them.
5. Export group JSON. Upload the exported file over the matching file in data/.
6. Commit your changes in GitHub.

The builder is a local authoring tool. It cannot directly publish changes or synchronize drafts between classmates. Drafts are kept in this browser's local storage when available. Image-heavy drafts can exceed browser storage; the app warns you to export. Keep exported backups. Import is validated before merging; matching IDs require confirmation before replacement.

An exported group file contains ALL drafts for the selected group. It REPLACES the published file when uploaded; it is not a patch. Importing the existing published file first prevents accidental loss.

## Add a group

Add an entry to data/groups.json:

{
  "id": "knee",
  "name": "Knee & patella",
  "description": "Knee · Patella",
  "file": "data/knee.json"
}

Create data/knee.json as a JSON array of questions. Group IDs must be unique. No app code changes required. You can divide future content into more groups to keep files manageable.

## Question format

{
  "id": "foot-apaxial-cr-001",
  "type": "mcq",
  "projection": "AP axial foot",
  "topic": "central-ray",
  "prompt": "Where is the CR centered for the AP axial foot?",
  "options": [
    "Base of the third metatarsal",
    "First MTP joint",
    "Medial malleolus",
    "Head of the fifth metatarsal"
  ],
  "answer": "Base of the third metatarsal",
  "explanation": "The supplied guide centers the CR at the base of the third metatarsal, angled 10° toward the heel.",
  "source": "Connor Kelly · Lower extremity guide · AP / AP Axial Foot"
}

Required: id, type, projection, topic, prompt, answer, explanation.
For mcq, options is required: 2–8 distinct choices. The answer must exactly match one choice. IDs must be unique within their group.

Topics:
- central-ray: centering, angle, CR direction
- positioning: rotation, part position, distinguishing setup
- purpose: why a projection is used, structures demonstrated
- evaluation: identifying image criteria and superimposition

For short answer, use type "short", omit options, and optionally include:
"acceptedAnswers": ["IP joint", "Interphalangeal joint"]

Short answers ignore capitalization and repeated whitespace. They do not use AI or infer synonyms. Include accepted alternatives explicitly. Flashcards work with either type.

Keep the projection field as metadata. It is intentionally hidden during questions so identification questions do not give away their answer.

## Image questions

Add an image object to ANY question:

"image": {
  "src": "images/shoulder/ap-external.jpg",
  "alt": "Radiograph of the proximal humerus and shoulder joint",
  "caption": "Identify the projection"
}

Paths are relative to index.html, not to the JSON file. Match capitalization exactly. Upload the image at the matching path. Images open in a larger viewer when clicked.

The builder can embed JPG, PNG, or WebP files up to 5 MB into the JSON as data URLs. No extra image upload is then required. For a large bank, separate optimized image files keep JSON much smaller. HTTPS image URLs also work if the source permits loading; locally hosted files are more reliable.

Avoid labels, filenames in captions, alt text, and captions that reveal the tested answer. Use images you have permission to share, with patient identifiers removed. The included sample SVG is a geometric diagram, not a patient image or an anatomical substitute.

## Scaling and behavior

Questions are loaded once per visit. Group files load independently, so a bad group produces a visible error while valid groups remain available. The reference bank renders 50 results at a time. Sessions select from matching questions without duplication. Requested session length is capped to available questions.

Study progress and scores are session-only. Draft content is local to each browser; there is no shared server database. Quizzes are for self-study, and answers remain readable in the public JSON.

If you later ask ChatGPT to create banks, provide this schema and the relevant guide, ask for unique IDs and source references, and request only the four topic types above. Import the result into the builder to validate it before publishing.
