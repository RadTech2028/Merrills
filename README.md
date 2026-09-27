# Positioning Lab

Positioning Lab is a browser-based study tool for radiography students learning radiographic positioning, anatomy, central ray placement, and image evaluation.

The site is designed to supplement course material and positioning textbooks with customizable practice sessions, tests, and flashcards.

## Features

* Multiple-choice and short-answer questions
* Standard practice, test, and flashcard modes
* Study sessions filtered by body part, projection, and focus
* Optional timed sessions
* Custom question builder
* Personal question collections
* Image-supported questions
* Import and export support for question banks
* Browser-based local storage for personal questions
* Expandable shared question bank

## Study Modes

### Practice

Work through questions with the selected categories and study focuses.

### Test

Complete a question set as a test, with an optional time limit.

### Flashcards

Review material using flashcards during a study session.

Cards marked **Study again** return later in the session. Cards marked **Got it** are removed from the current session.

## Question Builder

The built-in **Question Builder** can be used to create custom study material.

Questions can be organized by:

* Category
* Focus
* Body part
* Projection family
* Projection or named method

Multiple-choice questions support custom answer choices and a designated correct answer. Short-answer questions and image-based questions are also supported.

Custom questions are stored locally in the browser under **My Questions** and remain separate from the shared question bank.

Personal question collections can be transferred or preserved using the backup and export tools.

## Question Bank

Shared questions are stored as JSON files in the `data` directory. Category files correspond to the study areas available from the main page.

The included question bank serves as a base that can be expanded as additional material is added.

### Data Files

`groups.json` defines the main study categories.

`focuses.json` defines the available study focuses.

`projections.json` defines body parts, projection families, projections, and named methods available throughout the site.

Individual category JSON files contain the corresponding question banks.

## Images

Question images can be stored in the `images` directory and referenced by their relative path. Images may also be embedded directly in custom questions.

Only appropriately de-identified images that are permitted for educational use should be included.

## Project Structure

```text
positioning/
├── index.html
├── data/
│   ├── groups.json
│   ├── focuses.json
│   ├── projections.json
│   └── ...
├── images/
│   └── ...
└── README.md
```

## Local Development

Positioning Lab loads question data from external JSON files and should be run through a local web server rather than directly from the filesystem.

For example:

```bash
python3 -m http.server 8000
```

The site will then be available at:

```text
http://localhost:8000
```

## GitHub Pages

Positioning Lab is compatible with GitHub Pages and other static hosting services. No server-side application or database is required.

All site files can be hosted from the repository root or from a subdirectory within an existing GitHub Pages site.

## Contributing Content

The shared question bank can be expanded by importing an existing category into the Question Builder, adding or modifying questions, and exporting the updated category JSON.

Because category exports contain the complete category question bank, the current category should be imported before making additions to avoid unintentionally replacing existing questions.

New categories, focuses, body parts, projection families, and named methods can be added through the corresponding files in the `data` directory. Each entry should use a unique ID.

Views with meaningfully different positioning or central-ray requirements should remain separate entries.

## Educational Use

Positioning Lab is intended as a supplemental study resource for radiography students. Positioning procedures, central-ray requirements, anatomy demonstrations, and evaluation criteria should be verified against the textbook edition and procedures used by the student's radiography program.
