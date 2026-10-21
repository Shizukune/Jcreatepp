using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace Jcreatepp.Editor
{
    /// <summary>
    /// Jcreate++ が生成した Cluster Script を読んで、Unity 側で必要なものを調べる。
    /// 生成コードの書き方（$.setPosition( など）に合わせた簡単な読み取りで、手書きのスクリプトには向かない。
    /// </summary>
    public sealed class ScriptAnalysis
    {
        /// <summary>CCK の Constants.CraftItemScriptableItemMaxSourceCodeByteCount（UTF-8 バイト）。</summary>
        public const int CraftItemMaxBytes = 20000;

        public bool MovesByScript;   // setPosition / setRotation
        public bool UsesForce;       // addImpulsiveForce（物理で動く）
        public bool UsesInteract;
        public bool UsesGrab;
        public bool UsesRide;
        public bool UsesCollide;
        public bool UsesUnityComponent; // getUnityComponent（ワールド専用）
        public int Bytes;
        public readonly List<string> AudioIds = new List<string>();
        public readonly List<string> WorldItemReferenceIds = new List<string>();
        public readonly List<string> SubNodes = new List<string>();

        static readonly Regex Moves = new Regex(@"\$\.(setPosition|setRotation)\(");
        static readonly Regex Force = new Regex(@"\$\.addImpulsiveForce\(");
        static readonly Regex Interact = new Regex(@"\$\.onInteract\(");
        static readonly Regex Grab = new Regex(@"\$\.onGrab\(");
        static readonly Regex Ride = new Regex(@"\$\.onRide\(");
        static readonly Regex Collide = new Regex(@"\$\.onCollide\(");
        static readonly Regex UnityComponent = new Regex(@"\.getUnityComponent\(");
        static readonly Regex Audio = new Regex("\\$\\.audio\\(\"");
        static readonly Regex Reference = new Regex("\\$\\.worldItemReference\\(\"");
        static readonly Regex SubNode = new Regex("\\$\\.subNode\\(\"");
        static readonly Regex StringLiteral = new Regex("\"((?:[^\"\\\\]|\\\\.)*)\"");

        public static ScriptAnalysis Analyze(string code)
        {
            var a = new ScriptAnalysis();
            if (code == null) code = "";
            // Two views of the same length: comments blanked (comments are Japanese explanations written
            // by Jcreate++), and additionally string contents blanked, so text such as "$.onGrab(" stored
            // in a text variable is never taken for a call. Calls are found in the second view; their
            // string arguments are read from the first at the same position.
            string withStrings;
            var code0 = Blank(code, out withStrings);
            a.MovesByScript = Moves.IsMatch(code0);
            a.UsesForce = Force.IsMatch(code0);
            a.UsesInteract = Interact.IsMatch(code0);
            a.UsesGrab = Grab.IsMatch(code0);
            a.UsesRide = Ride.IsMatch(code0);
            a.UsesCollide = Collide.IsMatch(code0);
            a.UsesUnityComponent = UnityComponent.IsMatch(code0);
            a.Bytes = Encoding.UTF8.GetByteCount(code);
            Collect(Audio, code0, withStrings, a.AudioIds);
            Collect(Reference, code0, withStrings, a.WorldItemReferenceIds);
            Collect(SubNode, code0, withStrings, a.SubNodes);
            return a;
        }

        /// <summary>Movable Item が要るか（スクリプトで動かす・力を加える・つかむ）。</summary>
        public bool NeedsMovable
        {
            get { return MovesByScript || UsesForce || UsesGrab || UsesCollide; }
        }

        /// <summary>Rigidbody を物理で動かすか（力・衝突）。スクリプトで位置を直接変えるなら false（Is Kinematic オン）。</summary>
        public bool PhysicsDriven
        {
            get { return (UsesForce || UsesCollide) && !MovesByScript; }
        }

        /// <summary>For each call found in <paramref name="code0"/>, reads its first string argument from <paramref name="withStrings"/>.</summary>
        static void Collect(Regex call, string code0, string withStrings, List<string> into)
        {
            foreach (Match m in call.Matches(code0))
            {
                var quote = m.Index + m.Length - 1;
                var literal = StringLiteral.Match(withStrings, quote);
                if (!literal.Success || literal.Index != quote) continue;
                var value = Unescape(literal.Groups[1].Value);
                if (!into.Contains(value)) into.Add(value);
            }
        }

        static string Unescape(string jsonString)
        {
            try
            {
                return Regex.Unescape(jsonString);
            }
            catch (System.ArgumentException)
            {
                return jsonString;
            }
        }

        /// <summary>
        /// Returns the code with "// ..." comments and the contents of "..." strings replaced by spaces;
        /// <paramref name="withStrings"/> gets the code with only the comments replaced. Both keep the
        /// original length and line breaks. Jcreate++ emits only double-quoted strings and line comments.
        /// </summary>
        static string Blank(string code, out string withStrings)
        {
            var noComments = new StringBuilder(code.Length);
            var noStrings = new StringBuilder(code.Length);
            var inString = false;
            for (var i = 0; i < code.Length; i++)
            {
                var c = code[i];
                if (inString)
                {
                    if (c == '\\' && i + 1 < code.Length)
                    {
                        noComments.Append(c).Append(code[i + 1]);
                        noStrings.Append("  ");
                        i++;
                    }
                    else if (c == '"')
                    {
                        inString = false;
                        noComments.Append(c);
                        noStrings.Append(c);
                    }
                    else
                    {
                        noComments.Append(c);
                        noStrings.Append(c == '\n' ? '\n' : ' ');
                    }
                    continue;
                }
                if (c == '"')
                {
                    inString = true;
                    noComments.Append(c);
                    noStrings.Append(c);
                    continue;
                }
                if (c == '/' && i + 1 < code.Length && code[i + 1] == '/')
                {
                    while (i < code.Length && code[i] != '\n')
                    {
                        noComments.Append(' ');
                        noStrings.Append(' ');
                        i++;
                    }
                    if (i < code.Length)
                    {
                        noComments.Append('\n');
                        noStrings.Append('\n');
                    }
                    continue;
                }
                noComments.Append(c);
                noStrings.Append(c);
            }
            withStrings = noComments.ToString();
            return noStrings.ToString();
        }
    }
}
