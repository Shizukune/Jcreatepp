using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Jcreatepp.Editor.Core
{
    /// <summary>
    /// A JSON object that keeps its keys in order, so a saved workspace is written back in the order it
    /// was read (small diffs, and the same order as Blockly's own save).
    /// </summary>
    public sealed class JsonObject
    {
        readonly List<string> keys = new List<string>();
        readonly Dictionary<string, object> values = new Dictionary<string, object>();

        public IList<string> Keys { get { return keys.AsReadOnly(); } }
        public int Count { get { return keys.Count; } }

        public object this[string key]
        {
            get
            {
                object v;
                return values.TryGetValue(key, out v) ? v : null;
            }
            set
            {
                if (!values.ContainsKey(key)) keys.Add(key);
                values[key] = value;
            }
        }

        public bool Has(string key)
        {
            return values.ContainsKey(key);
        }

        public void Remove(string key)
        {
            if (values.Remove(key)) keys.Remove(key);
        }

        public JsonObject Object(string key)
        {
            return this[key] as JsonObject;
        }

        public List<object> Array(string key)
        {
            return this[key] as List<object>;
        }

        public string String(string key, string fallback)
        {
            var s = this[key] as string;
            return s ?? fallback;
        }

        public double Number(string key, double fallback)
        {
            var v = this[key];
            return v is double ? (double)v : fallback;
        }

        public bool Bool(string key, bool fallback)
        {
            var v = this[key];
            return v is bool ? (bool)v : fallback;
        }
    }

    /// <summary>
    /// Small JSON reader and writer (no UnityEngine, so it is checked outside Unity too).
    /// Objects are <see cref="JsonObject"/>, arrays List&lt;object&gt;, numbers double, plus string, bool and null.
    /// Written like JavaScript's JSON.stringify (numbers, escapes), so the Web editor reads the files the same.
    /// </summary>
    public static class Json
    {
        /// <summary>Deepest nesting read (a saved workspace nests about 3 levels per block; the core allows 150 blocks deep).</summary>
        const int MaxDepth = 1000;

        public static object Parse(string text)
        {
            if (text == null) throw new FormatException("JSON がありません。");
            var p = new Parser(text);
            p.SkipSpace();
            var value = p.Value(0);
            p.SkipSpace();
            if (!p.AtEnd) throw p.Error("JSON の後ろに余分な文字があります");
            return value;
        }

        /// <summary>Parses, or returns null when the text is not JSON.</summary>
        public static object TryParse(string text)
        {
            try
            {
                return Parse(text);
            }
            catch (FormatException)
            {
                return null;
            }
        }

        /// <summary>One line, like JSON.stringify(value).</summary>
        public static string Write(object value)
        {
            var sb = new StringBuilder();
            WriteValue(sb, value, null, 0);
            return sb.ToString();
        }

        /// <summary>Indented by two spaces, like JSON.stringify(value, null, 2) (the Web editor's file save).</summary>
        public static string WritePretty(object value)
        {
            var sb = new StringBuilder();
            WriteValue(sb, value, "  ", 0);
            return sb.ToString();
        }

        /// <summary>A deep copy (objects and arrays are new; strings, numbers and booleans are shared).</summary>
        public static object Clone(object value)
        {
            var o = value as JsonObject;
            if (o != null)
            {
                var copy = new JsonObject();
                foreach (var k in o.Keys) copy[k] = Clone(o[k]);
                return copy;
            }
            var a = value as List<object>;
            if (a != null)
            {
                var copy = new List<object>(a.Count);
                foreach (var item in a) copy.Add(Clone(item));
                return copy;
            }
            return value;
        }

        public static string Number(double d)
        {
            if (double.IsNaN(d) || double.IsInfinity(d)) return "null";
            if (d == Math.Floor(d) && Math.Abs(d) < 1e21) return d.ToString("0", CultureInfo.InvariantCulture);
            var s = d.ToString("R", CultureInfo.InvariantCulture);
            var e = s.IndexOf('E');
            if (e < 0) return s;
            // JavaScript: 1e-7, 1.5e+21 (.NET: 1E-07, 1.5E+21)
            var exponent = s.Substring(e + 1);
            var sign = exponent.StartsWith("-") ? "-" : "+";
            var digits = exponent.TrimStart('+', '-').TrimStart('0');
            return s.Substring(0, e) + "e" + sign + (digits == "" ? "0" : digits);
        }

        static void WriteValue(StringBuilder sb, object value, string indent, int level)
        {
            if (value == null)
            {
                sb.Append("null");
                return;
            }
            var s = value as string;
            if (s != null)
            {
                WriteString(sb, s);
                return;
            }
            if (value is bool)
            {
                sb.Append((bool)value ? "true" : "false");
                return;
            }
            if (value is double)
            {
                sb.Append(Number((double)value));
                return;
            }
            if (value is int || value is long || value is float)
            {
                sb.Append(Number(Convert.ToDouble(value, CultureInfo.InvariantCulture)));
                return;
            }
            var o = value as JsonObject;
            if (o != null)
            {
                if (o.Count == 0)
                {
                    sb.Append("{}");
                    return;
                }
                sb.Append('{');
                var first = true;
                foreach (var k in o.Keys)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    NewLine(sb, indent, level + 1);
                    WriteString(sb, k);
                    sb.Append(indent == null ? ":" : ": ");
                    WriteValue(sb, o[k], indent, level + 1);
                }
                NewLine(sb, indent, level);
                sb.Append('}');
                return;
            }
            var a = value as List<object>;
            if (a != null)
            {
                if (a.Count == 0)
                {
                    sb.Append("[]");
                    return;
                }
                sb.Append('[');
                for (var i = 0; i < a.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    NewLine(sb, indent, level + 1);
                    WriteValue(sb, a[i], indent, level + 1);
                }
                NewLine(sb, indent, level);
                sb.Append(']');
                return;
            }
            throw new ArgumentException("JSON にできない値です: " + value.GetType().Name);
        }

        static void NewLine(StringBuilder sb, string indent, int level)
        {
            if (indent == null) return;
            sb.Append('\n');
            for (var i = 0; i < level; i++) sb.Append(indent);
        }

        static void WriteString(StringBuilder sb, string s)
        {
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4"));
                        else sb.Append(c);
                        break;
                }
            }
            sb.Append('"');
        }

        sealed class Parser
        {
            readonly string s;
            int i;

            public Parser(string text)
            {
                s = text;
            }

            public bool AtEnd { get { return i >= s.Length; } }

            public FormatException Error(string what)
            {
                return new FormatException(what + "（" + (i + 1) + " 文字目）");
            }

            public void SkipSpace()
            {
                while (i < s.Length && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r' || s[i] == '﻿')) i++;
            }

            public object Value(int depth)
            {
                if (depth > MaxDepth) throw Error("JSON の入れ子が深すぎます");
                if (AtEnd) throw Error("JSON が途中で終わっています");
                var c = s[i];
                if (c == '{') return Obj(depth);
                if (c == '[') return Arr(depth);
                if (c == '"') return Str();
                if (c == 't') return Word("true", true);
                if (c == 'f') return Word("false", false);
                if (c == 'n') return Word("null", null);
                if (c == '-' || (c >= '0' && c <= '9')) return Num();
                throw Error("JSON として読めない文字があります");
            }

            object Word(string word, object value)
            {
                if (string.CompareOrdinal(s, i, word, 0, word.Length) != 0) throw Error("JSON として読めない文字があります");
                i += word.Length;
                return value;
            }

            object Num()
            {
                var start = i;
                if (s[i] == '-') i++;
                while (i < s.Length && "0123456789.eE+-".IndexOf(s[i]) >= 0) i++;
                double d;
                if (!double.TryParse(s.Substring(start, i - start), NumberStyles.Float, CultureInfo.InvariantCulture, out d)) throw Error("数値を読めません");
                return d;
            }

            string Str()
            {
                i++; // "
                var sb = new StringBuilder();
                while (true)
                {
                    if (AtEnd) throw Error("文字列が閉じていません");
                    var c = s[i++];
                    if (c == '"') return sb.ToString();
                    if (c != '\\')
                    {
                        sb.Append(c);
                        continue;
                    }
                    if (AtEnd) throw Error("文字列が閉じていません");
                    var e = s[i++];
                    switch (e)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            int code;
                            if (i + 4 > s.Length || !int.TryParse(s.Substring(i, 4), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out code)) throw Error("\\u の後ろが読めません");
                            sb.Append((char)code);
                            i += 4;
                            break;
                        default: throw Error("文字列の \\ の後ろが読めません");
                    }
                }
            }

            JsonObject Obj(int depth)
            {
                i++; // {
                var o = new JsonObject();
                SkipSpace();
                if (!AtEnd && s[i] == '}')
                {
                    i++;
                    return o;
                }
                while (true)
                {
                    SkipSpace();
                    if (AtEnd || s[i] != '"') throw Error("オブジェクトのキーがありません");
                    var key = Str();
                    SkipSpace();
                    if (AtEnd || s[i] != ':') throw Error(": がありません");
                    i++;
                    SkipSpace();
                    o[key] = Value(depth + 1);
                    SkipSpace();
                    if (AtEnd) throw Error("オブジェクトが閉じていません");
                    if (s[i] == ',')
                    {
                        i++;
                        continue;
                    }
                    if (s[i] == '}')
                    {
                        i++;
                        return o;
                    }
                    throw Error(", か } がありません");
                }
            }

            List<object> Arr(int depth)
            {
                i++; // [
                var a = new List<object>();
                SkipSpace();
                if (!AtEnd && s[i] == ']')
                {
                    i++;
                    return a;
                }
                while (true)
                {
                    SkipSpace();
                    a.Add(Value(depth + 1));
                    SkipSpace();
                    if (AtEnd) throw Error("配列が閉じていません");
                    if (s[i] == ',')
                    {
                        i++;
                        continue;
                    }
                    if (s[i] == ']')
                    {
                        i++;
                        return a;
                    }
                    throw Error(", か ] がありません");
                }
            }
        }
    }
}
