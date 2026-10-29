namespace Jcreatepp.Editor.Core
{
    /// <summary>
    /// What the Unity block editor needs from Blockly besides converting: the shape of each block
    /// (inputs, fields, connections, colour) and the palette's starting blocks as Blockly saves them.
    /// Runs in the same engine right after the core bundle, through the entry CoreHost adds to the
    /// bundle when loading it (see <see cref="CoreHost"/>); the bundle file itself is not changed.
    ///
    /// Same rules as src/unityHost/core.ts: plain values in and out, never throws, a throwaway
    /// headless workspace with Blockly events off, and when Blockly throws inside, the core is marked
    /// broken (every later call is refused).
    ///
    /// Interim: this belongs in src/unityHost/core.ts (and then in jcreatepp-core.txt); it is here
    /// because the bundle cannot be rebuilt from this package.
    /// </summary>
    static class CoreEditorScript
    {
        /// <summary>An expression: the editor object, or a string saying why there is none.</summary>
        public const string Source = @"(function () {
  'use strict';
  var core = typeof JcreateppCore === 'object' && JcreateppCore ? JcreateppCore : null;
  if (!core || typeof core.editorAccess !== 'function') return 'ブロック処理（jcreatepp-core.txt）に、エディター用の入口がありません。';
  var access;
  try {
    access = core.editorAccess();
  } catch (e) {
    return 'ブロック処理のエディター用の入口を開けません（' + String(e) + '）。jcreatepp-core.txt の版がこの拡張と合っていないかもしれません。';
  }
  var Blockly = access.Blockly;
  if (!Blockly || !Blockly.Workspace || !Blockly.serialization || !Blockly.inputs) return 'ブロック処理の中に Blockly が見つかりません。';
  var I = Blockly.inputs;

  // Jint has no DOM. Blockly keeps an XML copy of every shadow block next to its JSON state (only
  // XML export reads it), so loading any input with a shadow (math_number in X, Y, Z, ...) threw
  // 'createElementNS of undefined'. A minimal element is enough for writing that copy.
  if (typeof document === 'undefined' && Blockly.utils && Blockly.utils.xml && typeof Blockly.utils.xml.injectDependencies === 'function') {
    var FakeNode = function (name, text) {
      this.nodeName = name;
      this.tagName = name;
      this.nodeType = text === undefined ? 1 : 3;
      this.textContent = text === undefined ? '' : text;
      this.id = '';
      this.childNodes = [];
      this.attributeValues = {};
    };
    FakeNode.prototype.setAttribute = function (k, v) { this.attributeValues[k] = String(v); };
    FakeNode.prototype.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attributeValues, k) ? this.attributeValues[k] : null; };
    FakeNode.prototype.hasAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attributeValues, k); };
    FakeNode.prototype.removeAttribute = function (k) { delete this.attributeValues[k]; };
    FakeNode.prototype.hasAttributes = function () { return this.id !== '' || Object.keys(this.attributeValues).length > 0; };
    FakeNode.prototype.hasChildNodes = function () { return this.childNodes.length > 0; };
    FakeNode.prototype.appendChild = function (c) { this.childNodes.push(c); return c; };
    FakeNode.prototype.removeChild = function (c) { var i = this.childNodes.indexOf(c); if (i >= 0) this.childNodes.splice(i, 1); return c; };
    FakeNode.prototype.insertBefore = function (c, ref) { var i = this.childNodes.indexOf(ref); if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c); return c; };
    FakeNode.prototype.cloneNode = function (deep) {
      var copy = new FakeNode(this.nodeName, this.nodeType === 3 ? this.textContent : undefined);
      copy.textContent = this.textContent;
      copy.id = this.id;
      for (var k in this.attributeValues) if (Object.prototype.hasOwnProperty.call(this.attributeValues, k)) copy.attributeValues[k] = this.attributeValues[k];
      if (deep) for (var i = 0; i < this.childNodes.length; i++) copy.childNodes.push(this.childNodes[i].cloneNode(true));
      return copy;
    };
    Object.defineProperty(FakeNode.prototype, 'firstChild', { get: function () { return this.childNodes[0] || null; } });
    Object.defineProperty(FakeNode.prototype, 'children', { get: function () { return this.childNodes.filter(function (c) { return c.nodeType === 1; }); } });
    // XML text is never read or written here; these only have to exist (Blockly constructs them).
    var NoXmlText = function () {};
    NoXmlText.prototype.parseFromString = function () { throw new Error('XML の読み込みには対応していません。'); };
    NoXmlText.prototype.serializeToString = function () { throw new Error('XML の書き出しには対応していません。'); };
    Blockly.utils.xml.injectDependencies({
      document: {
        createElementNS: function (ns, name) { return new FakeNode(name); },
        createElement: function (name) { return new FakeNode(name); },
        createTextNode: function (text) { return new FakeNode('#text', String(text)); }
      },
      DOMParser: NoXmlText,
      XMLSerializer: NoXmlText
    });
  }

  function message(e) {
    return e && e.name ? e.name + ': ' + e.message : String(e);
  }

  function textOf(t) {
    if (typeof t === 'string') return t;
    if (t && typeof t.alt === 'string') return t.alt;
    return t === null || t === undefined ? '' : String(t);
  }

  function checkOf(connection) {
    if (!connection) return null;
    var c = connection.getCheck();
    return c ? c.slice() : null;
  }

  function numberOrNull(n) {
    return typeof n === 'number' && isFinite(n) ? n : null;
  }

  function describeField(field) {
    var f = { name: field.name || '', kind: 'label', text: textOf(field.getText()) };
    if (field instanceof Blockly.FieldDropdown) {
      f.kind = 'dropdown';
      f.value = String(field.getValue());
      f.options = [];
      var options = field.getOptions(false);
      for (var i = 0; i < options.length; i++) {
        if (Array.isArray(options[i])) f.options.push([textOf(options[i][0]), String(options[i][1])]);
      }
    } else if (Blockly.FieldNumber && field instanceof Blockly.FieldNumber) {
      f.kind = 'number';
      f.value = Number(field.getValue());
      f.min = numberOrNull(field.getMin());
      f.max = numberOrNull(field.getMax());
      f.precision = numberOrNull(field.getPrecision());
    } else if (Blockly.FieldTextInput && field instanceof Blockly.FieldTextInput) {
      f.kind = 'text';
      f.value = String(field.getValue());
    } else if (Blockly.FieldCheckbox && field instanceof Blockly.FieldCheckbox) {
      f.kind = 'checkbox';
      f.value = String(field.getValue());
    } else if (field.EDITABLE && field.name) {
      // A field this editor cannot edit (colour, variable, ...): shown as text, its value kept as saved.
      f.kind = 'other';
    }
    return f;
  }

  function tooltipOf(block) {
    try {
      var t = block.tooltip;
      while (typeof t === 'function') t = t.call(block);
      // Blockly's own blocks name messages (%{BKY_...}) that the core does not load.
      return typeof t === 'string' && t.indexOf('%{BKY_') < 0 ? t : '';
    } catch (e) {
      return '';
    }
  }

  /** Blockly's own blocks name a style instead of a colour; the Web editor uses the default (Classic) theme. */
  function colourOf(block) {
    var style = typeof block.getStyleName === 'function' ? block.getStyleName() : '';
    var classic = Blockly.Themes && Blockly.Themes.Classic;
    if (style && classic && classic.blockStyles && classic.blockStyles[style]) return String(classic.blockStyles[style].colourPrimary);
    return String(block.getColour());
  }

  function describeBlock(block) {
    var s = {
      type: block.type,
      colour: colourOf(block),
      output: !!block.outputConnection,
      outputCheck: checkOf(block.outputConnection),
      previous: !!block.previousConnection,
      previousCheck: checkOf(block.previousConnection),
      next: !!block.nextConnection,
      nextCheck: checkOf(block.nextConnection),
      inline: !!block.getInputsInline(),
      hat: typeof block.hat === 'string' ? block.hat : '',
      tooltip: tooltipOf(block),
      inputs: []
    };
    for (var i = 0; i < block.inputList.length; i++) {
      var input = block.inputList[i];
      var kind = input instanceof I.StatementInput ? 'statement'
        : input instanceof I.ValueInput ? 'value'
        : I.EndRowInput && input instanceof I.EndRowInput ? 'endrow'
        : 'dummy';
      var fields = [];
      for (var j = 0; j < input.fieldRow.length; j++) {
        if (input.fieldRow[j].isVisible()) fields.push(describeField(input.fieldRow[j]));
      }
      s.inputs.push({ kind: kind, name: input.name || '', check: input.connection ? checkOf(input.connection) : null, visible: input.isVisible(), fields: fields });
    }
    return s;
  }

  /** Runs work on a throwaway headless workspace with events off; puts Blockly back whatever happens. */
  function run(work) {
    var broken = access.broken();
    if (broken) return { ok: false, error: broken, broken: true, json: '' };
    access.register();
    var group = Blockly.Events.getGroup();
    var recordUndo = Blockly.Events.getRecordUndo();
    Blockly.Events.disable();
    try {
      var ws = new Blockly.Workspace();
      try {
        return { ok: true, error: '', broken: false, json: JSON.stringify(work(ws)) };
      } finally {
        // A failure here leaves Blockly half cleaned up, so it counts as broken too (like core.ts).
        ws.dispose();
      }
    } catch (e) {
      var reason = 'ブロックの形を調べている途中で問題が起きました（' + message(e) + '）。ブロックエディターを開き直してください。';
      access.markBroken(reason);
      return { ok: false, error: reason, broken: true, json: '' };
    } finally {
      Blockly.Events.enable();
      Blockly.Events.setGroup(group || false);
      Blockly.Events.setRecordUndo(recordUndo);
    }
  }

  function refused(error) {
    return { ok: false, error: error, broken: false, json: '' };
  }

  function shapesOf(ws, types, into) {
    var unknown = [];
    for (var i = 0; i < types.length; i++) {
      var type = types[i];
      if (into[type]) continue;
      if (typeof type !== 'string' || !Blockly.Blocks[type]) {
        unknown.push(String(type));
        continue;
      }
      var block = ws.newBlock(type);
      into[type] = describeBlock(block);
      block.dispose(false);
    }
    return unknown;
  }

  function typesIn(state, out) {
    if (!state || typeof state !== 'object') return;
    if (typeof state.type === 'string' && out.indexOf(state.type) < 0) out.push(state.type);
    if (state.inputs && typeof state.inputs === 'object') {
      for (var name in state.inputs) {
        if (!Object.prototype.hasOwnProperty.call(state.inputs, name)) continue;
        typesIn(state.inputs[name].block, out);
        typesIn(state.inputs[name].shadow, out);
      }
    }
    if (state.next) {
      typesIn(state.next.block, out);
      typesIn(state.next.shadow, out);
    }
  }

  function hueColour(colour) {
    var n = Number(colour);
    if (colour !== '' && !isNaN(n) && Blockly.utils && Blockly.utils.colour) return Blockly.utils.colour.hueToHex(n);
    return typeof colour === 'string' ? colour : '';
  }

  /**
   * The palette from a toolbox definition (src/toolbox.ts as JSON): each starting block as Blockly
   * saves it (every field filled in, shadows included), and the block types whose shapes the editor
   * needs (every type in the palette and every Jcreate++ block type).
   */
  function palette(toolboxJson) {
    var toolbox;
    try {
      toolbox = JSON.parse(toolboxJson);
    } catch (e) {
      return refused('パレットの定義を読めません（JSON の形になっていません）。');
    }
    if (!toolbox || !Array.isArray(toolbox.contents)) return refused('パレットの定義の形が違います。');
    return run(function (ws) {
      var categories = [];
      var types = [];
      for (var i = 0; i < toolbox.contents.length; i++) {
        var c = toolbox.contents[i];
        if (!c || c.kind !== 'category') continue;
        var items = [];
        var contents = Array.isArray(c.contents) ? c.contents : [];
        for (var j = 0; j < contents.length; j++) {
          var item = contents[j];
          if (!item) continue;
          if (item.kind === 'label') items.push({ kind: 'label', text: String(item.text || '') });
          else if (item.kind === 'button') items.push({ kind: 'button', text: String(item.text || ''), callbackKey: String(item.callbackKey || '') });
          else if (item.kind === 'block' && typeof item.type === 'string' && Blockly.Blocks[item.type]) {
            var state = {};
            for (var k in item) {
              if (Object.prototype.hasOwnProperty.call(item, k) && k !== 'kind') state[k] = item[k];
            }
            var block = Blockly.serialization.blocks.append(state, ws, { recordUndo: false });
            var saved = Blockly.serialization.blocks.save(block, { addCoordinates: false, addNextBlocks: true });
            block.dispose(false);
            typesIn(saved, types);
            items.push({ kind: 'block', type: item.type, template: saved });
          }
        }
        categories.push({ name: String(c.name || ''), colour: hueColour(String(c.colour === undefined ? '' : c.colour)), items: items });
      }
      var all = Object.keys(Blockly.Blocks).sort();
      for (var t = 0; t < all.length; t++) {
        if (all[t].indexOf('jcreatepp_') === 0 && types.indexOf(all[t]) < 0) types.push(all[t]);
      }
      // The shapes come from shapes(), a few at a time (all at once is close to one call's time limit).
      return { categories: categories, types: types };
    });
  }

  /** The shapes of the given block types (a JSON array of names); unknown names are listed, not an error. */
  function shapes(typesJson) {
    var types;
    try {
      types = JSON.parse(typesJson);
    } catch (e) {
      return refused('ブロックの種類の一覧を読めません。');
    }
    if (!Array.isArray(types)) return refused('ブロックの種類の一覧の形が違います。');
    return run(function (ws) {
      var into = {};
      var unknown = shapesOf(ws, types, into);
      return { shapes: into, unknown: unknown };
    });
  }

  return { palette: palette, shapes: shapes };
})()";
    }
}
