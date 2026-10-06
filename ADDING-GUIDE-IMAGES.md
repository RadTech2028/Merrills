# Adding guide images

Upload this update into the **top level of your existing Merrills repository**. Merge the `data` folder with the one already there. Keep the folder names and capitalization exactly as supplied. Your existing question banks and Google configuration stay in place; no Apps Script redeployment is needed.

Put patient-position photographs in **Pimage** and radiographs in **Ximages**.

Open **data/guides/projections.json**, find the body part and projection, and look for:

```json
"images": {
  "patient": [],
  "xray": []
}
```

Replace it with your image paths, for example:

```json
"images": {
  "patient": [
    { "src": "Pimage/knee-ap-position.jpg", "alt": "Patient positioned for an AP knee" },
    { "src": "Pimage/knee-ap-centering.jpg", "alt": "AP knee central-ray centering", "caption": "Centering" }
  ],
  "xray": [
    { "src": "Ximages/knee-ap.jpg", "alt": "AP knee radiograph" }
  ]
}
```

Add as many entries as you need, separated by commas. The order in the file is the order shown. An empty list shows “Images coming soon.” Each gallery scrolls independently; on phones they stack. Images are loaded when needed and are not copied into browser progress or cloud backups.

PNG, JPG, JPEG, WebP, GIF and AVIF are supported. Use short filenames without spaces, and match uppercase/lowercase exactly. Use images you may share and remove identifying patient information.

## Adding another projection

Copy a view inside the correct part’s `views` list. Give it a new, permanent `id`, change its name and criteria, and clear both image lists. To add a part, copy a part object and give it a new `id` and `name`. The menus, overview and completion badges update from this file automatically.

Keep existing IDs unchanged: saved review progress uses them. Editing a criterion’s text resets its answer statistics; marks and previously earned badges remain. Empty parts do not earn completion badges.

`key` holds the short highlighted distinction. `cr` separates the angle from the centering point. `evaluation` holds individual bullet points. Optional `sid` and `respiration` fields can be empty. `sourcePages` uses PDF page numbers, starting with page 1 of the supplied PDF—not printed textbook pages.

## Review and progress

Use the corner **Review settings** control to choose criteria and review one projection, one part, or all parts. “Study again” returns the criterion to the pile; “Got it” removes it for that set. Smart review favors less familiar criteria when you start another set.

Guide records use the existing local progress store, backups and Google sync. A completed set triggers cloud saving when signed in. There are new line-art badges, and **My progress → Guide review progress** shows completion by part. A guide-part badge requires every available criterion in every projection to have been recalled correctly at least once. Simply opening a guide earns nothing.

## Source distinctions preserved

The guide content summarizes only the supplied Merrill’s PDF. Your personal guide informed the concise writing style.

- Wrist medial-rotation oblique is labeled **AP** in this source; the requested PA wording remains a search alias.
- Both Lawrence shoulder methods have separate entries to avoid confusing transthoracic and inferosuperior techniques.
- The upright lateral ankle entry points to the source’s upright lateromedial option. The book does not give it a separate weight-bearing protocol.
- The detailed Merchant instructions use 40° knee flexion and a beam 30° below horizontal; the source also discusses other flexion angles.
- The 45° ankle oblique and mortise share central-ray centering; their rotation and demonstrated joint spaces differ.

Receptor sizes reflect the supplied book’s CR-plate recommendations. Department detector choices can differ. Source page references are included in every guide for checking details.
