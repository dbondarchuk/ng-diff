# ng-diff
Angular.JS directive for visual diff of two texts

Based on (https://github.com/cemerick/jsdifflib)

Allows to view diff of two texts side-by-side or inline.
Demo: (http://cemerick.github.io/jsdifflib/demo.html)

# Installation
Download from **GitHub**
Or
Use **Bower**:
`bower install ng-diff`

# Usage

1. Inlcude scc/js files from the package
2. Include '*ngDiff*' module to your *app.js*
3. Add directive to your html: 
```html
<ng-diff left="leftText" right="rightText" left-title="leftTitle" right-title="rightTitle" not-show-equal="false" inline="false" context-size="2" inline-title-func="myTitleFunc"></ng-diff>
```
# Argumens supported by directive

Argument | Required | Type | Default | Description
--- | --- | --- | --- | ---
left | `true` | `string` | `null` | Text of the left side
right | `true` | `string` | `null` | Text of the right side
left-title | `true` | `string` or `html` | `null` | Title of the left side (supports html)
right-title | `true` | `string` or `html` | `null` | Title of the left side (supports html)
not-show-equal | `false` | `boolean` | `false` | If true, only not equal lines will be shown
inline | `false` | `boolean` | `false` | If true, swithces to inline view. If false, uses side-by-side view
context-size | `false` | `number` or `null` | `null` | Context size
inline-title-func | `false` | `function` or `null` | `() => leftTitle + ' vs ' + rightTitle` | Function to generate title for inline view.