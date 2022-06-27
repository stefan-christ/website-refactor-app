# website-refactor-app v0.0.1

Diese App dient dem Zweck, Quelldateien (html, php, css etc.) einer Website automatisiert umzuschreiben.

Problemstellung:

1. Die Website beinhaltet verlinkte Dateien (bspw. Bilder), die derzeit im Wurzel-Verzeichnis der Website liegen.
2. Diese Dateien sollen in ein Unterverzeichnis des Wurzel-Verzeichnisses verschoben werden.
3. Bereits vorhandene Verlinkungen (URLs) in den Quelldateien sollen auf den neuen Lagerort der Dateien umgeschrieben werden.

Problemlösung:

1. Die App über configuration.jsonc konfigurieren. Siehe Punkt "Konfiguration" (weiter unten).
2. Ein neues Verzeichnis im Wurzelverzeichnis erstellen.
3. Die verlinkten Dateien in das neue Verzeichnis verschieben.
4. App starten. Siehe Punkt "Starten der App" (weiter unten).
5. Menü-Punkt 'refactor source files' wählen.
6. Den Namen (nicht den Pfad) des neuen Verzeichnisses angeben.
7. Menü-Punkt 'wet run' wählen.
8. Abwarten und Tee trinken.

Beschränkungen:

-   es können nur verlinkte Dateien behandelt werden, die im Wurzel-Verzeichnis der Website liegen.
-   der neue Lagerort der verlinkten Dateien muss ein Verzeichnis sein, das im Wurzel-Verzeichnis der Website liegt.
-   Quelldateien müssen in der Zeichenkodierung UTF-8 vorliegen.
-   Die Namen der verlinkten Dateien dürfen nicht die Zeichen `(`, `)` und `Leerzeichen` enthalten.

---

## Voraussetzungen

Vorhandene Installation von

-   Node.js, mind. v16.15.1
-   NPM, mind. v8.11.0.

Download unter
https://nodejs.org/

## Installation der App

Mit der Kommandozeile in das Verzeichnis wechseln, das die Datei 'package.json' enthält.
Danach das folgende Kommando ausführen.

```bash
$ npm install
```

## Starten der App

Mit der Kommandozeile in das Verzeichnis wechseln, das die Datei 'package.json' enthält.
Danach das folgende Kommando ausführen.

```bash
$ npm run start
```

## Konfiguration

In der Datei configuration.jsonc wird definiert, wie die App arbeitet.

-   workingDir: Pfad auf das Arbeitsverzeichnis. Hier werden Ergebnisse und Log-Dateien abgelegt.
-   wwwDir: Pfad auf das Wurzel-Verzeichnis der Website
-   refactor.sourceFileTypes: eine Liste von Datei-Endungen. In Dateien mit diesen Endungen werden URLs gesucht und ggf. ersetzt.
-   refactor.replacementExclusionFileTypes: eine Liste von Datei-Endungen. URLs auf Dateien mit diesen Endungen werden ignoriert und nicht ersetzt.

## App-Menü-Übersicht

-   (1) refactor source files
    -   entering media directory name
        -   (1) check conditions
        -   (2) dry run (no changes will be made)
        -   (3) wet run (file contents are edited)
        -   (4) choose a different directory name
        -   (5) go back
        -   (6) quit
-   (2) analyze file types (www)
    -   (1) non-recursive
    -   (2) recursive
    -   (3) go back
    -   (4) quit
-   (3) analyze file types (custom)
    -   entering custom directory path
        -   (1) non-recursive
        -   (2) recursive
        -   (3) choose a different directory path
        -   (4) go back
        -   (5) quit
-   (4) analyze FTP files
    -   (1) find case conflicts
    -   (2) find symbolic links
    -   (3) find problematic characters
    -   (4) dispose cached file info
    -   (5) go back
    -   (6) quit
-   (5) quit
