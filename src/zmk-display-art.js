// Exact 1-bit indexed pixel payloads from ZMK's historical nice!view status art.
// Source: zmkfirmware/zmk at f1b944b1efc01805a769cb2b15797c2c611bcc5f
// File: app/boards/shields/nice_view/widgets/art.c
// Copyright (c) 2023 Collin Hodge and The ZMK Contributors; MIT licensed.

export const ZMK_NICE_VIEW_SOURCE = Object.freeze({
  repository: "https://github.com/zmkfirmware/zmk",
  commit: "f1b944b1efc01805a769cb2b15797c2c611bcc5f",
  width: 140,
  height: 68,
  rowBytes: 18,
});

const ASSETS = Object.freeze({
  mountain: Object.freeze({
    id: "mountain",
    name: "ZMK Mountain",
    sha256: "a43c48276824205483b0d3d3db56e8524304148096cbf4870d3751c0c0992ac3",
    payloadBase64: "///////////////////////wwAAAAAAuAAAAAAwAAAAAkAAwgAAAAABfoAAAAAYAAAAAkAAQgP//////9AAAAAP/////n/8QgP///////0AAAAH+A+APngGQgP///////+gAAAD/B+AfngCQgH////////2AAAB/j+AfvgCQgH/////////QAAA/z/AfvACQgH/////////+AAA/z/A/vACQgH/////////oAAAf5/B/PACQgD////////6AAAAP5/h/eAGwgD///////+wAAAAH8/g/eAPQgD///////sAAAAAH+/g/+A+QwB//////7AAAAAAD/fw/+A8QwB7/////QAAAAAAB//w/8A4QwAwn///6AAAAAAAA//5/8B4wwAAf//9QAAAAAAAAf/5/8/xQ4AA///oAAAAAAAAAf/5/9/iQ4AB//rAAAAAAAAAAP/9/5/GQ4AB//wAAAAAAAAAAH/9/7+OQ8AB//6AAAAAAAAAAB/9//+eQsBD///YAAAAAAAAAA/+//8+Q8DD///9gAAAAAAAAAf/5/5+QsDD////yAAAAAAAAAP/2/z6Q+HD/////YAAAAAAAAH/2/nyQ+Hj/////9AAAAAAAAA/5/viQqPj//////wAAAAAAAAP//fOQ3Pj/////6AAAAAAAAAH/+++Q9az////+wAAAAAAAAAD///+Q/9Z////kAAAAAAAAAAB///+Q//p///9AAAAAAAAAAAA///+Q3f9///YAAAAAAAAAAAAP///w6r8//6AAAAAAAAAAAAAD//AQ/0+/9QAAAAAAAAAAAAAB/wAQ//+foAAAAAAAAAAAAAAA///w/7DLAAAAAAAAAAAAAAAD//+QzWBgAAAAAAAAAAAAAAIf//+QsuA2AAAAAAAAAAAAAAx///+Q/8A/QAAAAAAAAAAAABj///+Q/sB/6AAAAAAAAAAAAPH//3yQ/YD//YAAAAAAAAAAD8P//7iQ/4D//+gAAAAAAAAAP4f//8iQnwH///4AAAAAAAAAfx///+CQhgH//9AAAAAAAQAA/j///+CQgAH//oAAAAAABhmD/n////CQgAH//AAAAAAADH/H7n////iQgBq/sAAAAAABmP//xn////yQgD9dAAAAAAAD8f//wH////6QgD/4AAAAAAAH4///AP////+QgH/+gAAAAAAPx//+GP/v//+QgH//0AAAAAAPj//8f//v/f+QgP//+gAAAAAfn//4///v/PeQgP///2AAAAA/H//x///P/OGQgP////QAAAB/P//j///P/mCQgf////6AAAB/P//H///f/kCQgf/////4AAH+P//Pv//f/gCQgf////9AAAf+f/+Pf/+f/gCQgP///+YAAB/+f/8e//+R/gCQgP///sAAAD/8f/48//+B/wCQgH//7AAAPP/4//x5/f+A/wCQgCf/gAAAf//5//zz+/8A/wCQgF//2AAA///x/8jn8/8AfwCQgP///YAB///j/4HP9/8AfwCQgP///9gD//+H/wOP5/8AP4GQgf////6D//4P/j//z/////8QgAAAAC/GAAA4AGAASAAAAAAQwAAAABf0AADgAMAAiAAAAAAw///////////////////////w",
  }),
  balloon: Object.freeze({
    id: "balloon",
    name: "ZMK Balloon",
    sha256: "c1319e926e813d44839e1e62d66a5b1bf55cfadade9dc79beacce73b38789492",
    payloadBase64: "/qoKKp/////66qquuv//+//w8VUFFUf////11VVff//////wpKqKiqH///vqqqq+v+/7+//wVFUFRVT//31V1XV/f9/////wriqCoKo///6q6rv+v//7+/7wX1UBUFQf/39V1X//f9f//f3wL/8gKAAP/66qqr///+v7///wDgFQFAA//1dV1X//f9f9//3wHgGoCgD//6+qqv///6/7///wH/lQAQP//1dV1X3/f9/9//3wn/moAI///q+qqv///b/7//vwWgFUAD///39d1f3//d/9//3wjgGqAH///r+u7///++/7//rwz//0APf//39d/////d////3wrgEqAPv//7+u/////v/7//rw3gE1Afv//39d/b///9/9/93wp//qgfz/f76+/+P//+//+T7wVgFVQf9////9/fwf/////H3wpgEqiP7///7+/v/gA////P7wUnkVRH3///1/vf///AAH+P3wImkqoD3///r+f////+JI+v/wQlkVVBv///f/vff//5VVN33wAmkKoh/+/+7///z//ypKn//wA/9VEU///1V//f8A/FVVT//wAgGqiI/e/6q//v//AKgCp//wAgFVVUf/f9Vf////yEdcU//wgkmqiqf+/+q/////sD9fif/wwklVRVP///Vf///+cH9f5f/w4kGioqv++/qv7//54r9f+v/w4kFRUVH/d/1X+f/nhX9f/P/w4//yoKj/+76v/h6AaoAAfv+w4mARUFR///1X/+AfxBVVBn9w7mAYqCof//6v/+jwAApKqH/w3//xVBVD//9f/+h7wAVVVX9w/4Eoqgqh//6/9+oJ4ApKqn/w/4FQVAVUf/9//OhLwAVVVX9w/n8oqgCo//6//wrwAAJKqH6w/n8UVQAD//dff+AfxAFVBn9w/4EIKoAH//av//6AaoAAfv+wf4EUVUAP/+1Xf//nhVVf/P9wv//oKqgf//au///56qpf+v/wXgEkFVQ///VXf/v+8FVf5f9wvgEiKqD//7qu//4fMCoPib/wX//lFUH//9VXf//gSAVUU//wvgGiAgP//+qqv///gAACp7/wXgFBAAb9/9VVX////ABAT//wvkkggA9//uqqvv///wAAH7/wfklQAA9//9VVX4P//4BAP//w/kEoAA+//+uqv/wAA+AA/7/w/kEUAB/f/9XVV////AAH/9/w//8IAB8/3+uqq////////7/w/gEUQD7/v/VVV9//+f///9/w/gEKID//3/qqq7//8///37/w3n8FEH////1VVd//5P//v3/w7n4CiH////qqq7//4/+/v7/w3gVBVD///91VVf//1//ff3/w7gaiqj///76qq7//9/+/P7/w3n1VVR/7//9VVf//+///v//w/n+qqo///7qqq/////+/37/w/gFVVUf///fVV//////////w/gGqqqH//7/qq/////+////w//9VVVT//1/1V//9///////w/9qqqqp//7/6q//7///////w/51VVQD//3/9V////9/////w/7+iqAP/+7/6qr/7/7/////w/z/AAAf//1/9V1f////////w/z+AAA//+6/+rqr7/7/////w9n/AAA///1f9VVV3//////3w",
  }),
});

function decodeBase64(value) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function zmkNiceViewAsset(id) {
  const asset = ASSETS[id];
  if (!asset) throw new Error(`Unknown ZMK nice!view artwork: ${id}`);
  const payload = decodeBase64(asset.payloadBase64);
  const expectedLength = ZMK_NICE_VIEW_SOURCE.rowBytes * ZMK_NICE_VIEW_SOURCE.height;
  if (payload.length !== expectedLength) throw new Error(`ZMK ${id} artwork payload is corrupt.`);
  return Object.freeze({
    id: asset.id,
    name: asset.name,
    sha256: asset.sha256,
    width: ZMK_NICE_VIEW_SOURCE.width,
    height: ZMK_NICE_VIEW_SOURCE.height,
    rowBytes: ZMK_NICE_VIEW_SOURCE.rowBytes,
    payload,
  });
}
