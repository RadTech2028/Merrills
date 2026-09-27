# Positioning Lab

Positioning Lab is a small study site for radiography students. It is meant to be used alongside class notes and your positioning textbook.

## Adding it to GitHub Pages

Download and unzip the folder. If you already have a GitHub Pages repository, create a folder named `positioning` and put the contents of this folder inside it. Make sure `index.html` is directly inside `positioning`, with the `data` and `images` folders beside it.

After committing the files, the site should be available at:

`https://your-username.github.io/your-repository/positioning/`

If you are putting it in a new repository, place the contents at the top level instead and turn on GitHub Pages for that repository.

Do not open `index.html` by double-clicking it while testing on your computer. The question files need to be loaded through a web server. One simple option is:

```text
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Using the site

Choose the areas you want to study, select the kind of information you want to focus on, and start a session. You can work through questions normally, take a test, or use flashcards.

Flashcards that you mark “Study again” return later in the same session. They leave the session after you mark them “Got it.” You can also set a time limit before starting.

The question bank that comes with this download is only a starting point. The empty sections are there so more material can be added later.

## Making your own questions

Use **Question builder** to make questions for yourself. First choose the category, focus, body part, and projection family. The next menu will show the available projections and named methods for that part. For example, the ankle list keeps the 45° medial oblique separate from the 15–20° mortise view.

For multiple-choice questions, type the choices and select the circle beside the correct answer. You can also make short-answer questions and attach an image.

Saved questions appear under **My questions**. They are saved in the browser on that computer, so they are separate from the shared questions and are not automatically sent to anyone else. Use **Export full backup** if you want to keep a copy or move your questions to another computer.

You can copy a question from the program bank into your personal collection and edit the copy. This is useful when you want to add a better explanation, an image, or wording that makes more sense to you.

## Adding questions for everyone

Questions that should be part of the shared website are stored in the JSON files inside `data`. The file names match the categories shown on the home page.

The easiest workflow is:

1. Import the current category file into the builder.
2. Add or edit the questions.
3. Export that category.
4. Replace the old category file in the repository with the exported file.
5. Commit the change to GitHub.

The exported file replaces the whole category, so importing the current file first prevents older questions from being lost.

Images can be kept in the `images` folder and referenced by their path, or embedded directly when creating a question. Remove patient identifiers and only use images you are allowed to share.

## Adding categories and projection choices

New categories and focuses can be added from the builder for personal use. To add them to the shared site, edit the matching files in `data`:

- `groups.json` controls the main categories.
- `focuses.json` controls the focus options.
- `projections.json` controls the body parts, projection families, named methods, and the choices shown in the builder.
- The individual category JSON files contain the questions.

Give each new category, focus, body part, and projection a unique ID. Keep separate entries when the positioning or central ray makes two views meaningfully different.

The included material is a starter resource. Check questions against the textbook edition and the procedures used in your program before publishing them for everyone.
