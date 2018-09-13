# The Still Very Much Untitled Library

*For now it's iso-app - as in isomorphic (runs everywhere)*

Smooths sharp edges between APIs and makes bringing your app cross-platform a joy.

## Motivation

Building HTML & JS apps isn't an easy task and trying to port the app from one platform to another often takes hours if not days of head-scrathing despite running the same language. Because each platform has its set of different APIs, or missing features, restrictions, quirks and WTFs. Just to name a few:

* cross window and cross thread/worker communication (IPC) is a nightmare.
* Confusing main (background script) and renderer (html ui) processes in Electron.
* "*Why is Chrome adding my app as a bookmark and not a PWA? I've already created manifest.json and an icon!*"
* There's no 'maximized', 'unmaximized' events on the web. Also 'close', 'beforeunload' is a mess.
* service workers, offline caching and PWAs in general.
* Restricted window & instance managment in UWP.

## Features

`iso-app` saves you from each platform's common pitfalls and hides all the mess behind single and extremely **simple API that just works**, levels differences and adds couple convinient or missing features, methods and events. That way you can focus on the app.

* **Simple cross-platform API**
  <br>Takes daunting Electron APIs, restrictions of Web platform, possibilites of PWAs and hides it behind very simple `app` object (instance of `EventEmitter`) that can pass data between windows and processes and makes their managment easy.
* **Forget about the platform, focus on your app**
  <br>Let's you write simple self-documenting code that's easy to reason about.
  <br>You don't have to remember *that weird thing that happends with that confusing web API* anymore.
* **The API is shaped after Electron's `app` object**
  <br>Electron is popular among developers so this library's `app` object is modeled after Electron's `app` and seves as kind of an Electron polyfill on other platforms.
* **Porting to another platform is easy**
  <br>Maybe you've written Electron app, but desperately need the new feature that's only in the latest NW.JS. No problem. Just swap `electron.exe` for `nw.exe`.
* **Learn once, Write any app**
  <br>Today you may write Electron app, tomorrow it might be PWA or UWP. Doesn't matter. The code you need to write will always be the same.
* **For apps of all shapes and sizes**
  <br>`iso-app` works great in simple and small projects but really shines in large apps that make use of workers, threads, manage windows and IPC between them.
* **Simple managment of app windows** (or tabs, Windows Sets)
  <br>Open & close, move, resize, change or listen to their state of current window or other windows (if the app has any).
  <br>Simple events like `maximize`, `closing`, `closed`, `resize` and methods such as `.maximize()`,  `.close()`, `.resize(width, height)`, etc..
* **Composable plugins. Take only what you need**
  <br>Need some intensive tasks running in background threads? Throw in `iso-app-ipc` plugin. Want to open multiple app windows? Add `iso-app-window`. Or better yet, include `iso-app-pwa` & `iso-app-serviceworker` and let us turn the app into a PWA for you.
* **Great for prototyping**
  <br>when you're still looking for the right platform for your next project.
* **Rock solid in production**
  <br>Your app will work great once you're done experimenting and reliability and efficiency becomes a must.


### Platforms

* Web - simple web sites / web apps
* PWA - Progressive Web Apps
* UWP - Universal Windows Apps (Windows Store)
* Electron
* NW.JS
* Node - Console scripts

## Batteries included

Philosophy of this project is to do as much as possible for you. `iso-app` autodetects platform the app currently runs and tries to patch missing pieces (PWAs require additional `<meta>` and  `<link>` tags) or warns you about details you might've missed.

Plugin `iso-app-serviceworker` auto installs builtin service worker (unless you specify your own) and starts caching app's files for offline use. It then uses Network API to either serve cached files while on cellular data or when offline, or bypasses the cache and serves fresh when on wifi or localhost.

## Plugins

* **iso-app-window**
  <br>Adds support for opening and managing multiple app windows, and tabs (Windows 10 Sets).

* **iso-app-pwa**
  <br>Makes basic PWA chores for you.
  <br>*Tries to add mising <link> and <meta> tags where possible.*
  <br>*Doesn't add much functionality, rather warns about missteps in your app and unmet requirements that prevent browser from taking your app as PWA (Chrome is very picky).*

* **iso-app-manifest**
  <br>Loads manifest.json and makes it available in app object.
  <br>*Adds `app.name`, `app.icon` and `app.accent`.*

* **iso-app-serviceworker**
  <br>Installs serviceworker (default builtin or your own) and enables automatic caching of app's files.
  <br>*Watches and notifies when app's source code changes and keeps the file cache up to date.*
  <br>*Installs serviceworker. Checks if app has changed since last caching.*

* **iso-app-ipc**
  <br>Hooks up into all processes, child processes, windows, workers, and syncs state and events everywhere to ensure you can manage your app's state from anywhere.
  <br>*Supports both browswer's `.postMessage(...)`/`.addEventListener('message', ...)` and Node's `.send(...)`/`.on('message', ...)`*

* **iso-app-theme**
  <br>TODO

* **iso-app-systray**
  <br>TODO

* **iso-app-protocol**
  <br>TODO

* **iso-app-jumplist**
  <br>TODO

## Currect state

This project is still under heavy development, though some parts have stabilized already.

### Dogfeeding

I'm using this project build multiple apps, each on a different platform with different needs. And I'm bringing the experiences, needs and code from those apps into this library.

* [Anchora](https://github.com/MikeKovarik/anchora-app)
  <br>Primarily a Windows UWP app with mutli window and IPC support, that also has to work on Electron (so it could be brought to Mac)
* [NPM & Github GUI App](https://github.com/MikeKovarik/npm-gui-app)
  * Website & PWA catalogue of user's NPM packages & Github repos.
  * Progressively enhanced under Electron or NW.JS. Turns into full blown GUI manager for NPM and Github once it can acces terminal. e.g. You can publish code to NPM and push commits to Github and manage your libraries with ease.
* And a few yet unpublished websites & PWAs.


## API

### `iso-app-serviceworker`

#### Caching

Once service worker is installed, it intercepts all HTTP requests and **automatically stores app's JS, HTML & CSS files** (by their mime type, not just an extension, *so `.mjs` works out of the box too*) from the same origin.

For example if your domain is https://myapp.com, your app requests data from `https://google.com/calendar/my-events.json`, loads `https://cdn.com/jquery.js` and `./style.css` which then loads `https://myapp.com/logo.png`. We will only cache `./style.css` and `/logo.png`, but ignore the dependencies from and requests to other domains.

We also always cache `./` and `./index.html` (which is the same) and `./manifest.json`.

Note that **we're caching relative paths** `./index.html`, not absolute `/index.html` paths! That way your app files dont mix up if you have multiple projects running under the same domain i.e. `https://localhost/my-project-3`.

`cache` property is exposed so **you can manually [`.addAll()`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/addAll) files** you want to the cache for when the app is offline. The same way you would cache files in service worker.
```js
app.cache.addAll([
  '/',
  './something/important.js',
  '`https://cdn.com/jquery.js`',
])
```

#### Autocaching & Manual caching

iso-app automatically goes over all `<link>` and `<script>` tags and caches them. Given following `index.html`.

<table><tr><td>

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <h1>hello world</h1>
  <script src="./node_modules/platform-detect/index.js"></script>
  <script src="./node_modules/iso-app/iso-app.js"></script>
  <script src="./node_modules/iso-app/iso-app-serviceworker.js"></script>
  <script src="./my-app.js"></script>
</body>
</html>
```

</td><td>

iso-app will cache:

* `./` (which is `./index.html`)
* `./index.html`
* `./style.css`
* `./node_modules/platform-detect/index.js`
* `./node_modules/iso-app/iso-app.js`
* `./node_modules/iso-app/iso-app-serviceworker.js`
* `./my-app.js`

</td></tr></table>

Insides of CSS files (`@imports` and `url()`) and JavaScript ES Modules (`import` / `export` syntax) cannot be easily analyzed. You will have to manually cache whatever `import`s you use in your ES modules.

*NOTE: We're planning to fix this and fully automate imports as well in future releases.*

<table><tr><td>

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="./style.css">
</head>
<body>
  <h1>hello world</h1>
  <script type="module" src="./my-app.mjs"></script>
</body>
</html>
```

```js
// my-app.mjs
import platform from './node_modules/platform-detect/index.js'
import app from './node_modules/iso-app/iso-app.js'
import './node_modules/iso-app/iso-app-serviceworker.js'

app.cache.addAll([
  './node_modules/platform-detect/index.js',
  './node_modules/iso-app/iso-app.js',
  './node_modules/iso-app/iso-app-serviceworker.js',
  './bg.jpg'
])
```

```css
/* style.css */
body {
  background-image: url('./bg.jpg')
}
```

</td><td>

iso-app will cache:

* `./` (which is `./index.html`)
* `./index.html`
* `./style.css`
* `./my-app.mjs`

And it's up to you to manually register:

* `./node_modules/platform-detect/index.js`
* `./node_modules/iso-app/iso-app.js`
* `./node_modules/iso-app/iso-app-serviceworker.js`
* `./bg.jpg`

</td></tr></table>


## License

Mike Kovařík, Mutiny.cz