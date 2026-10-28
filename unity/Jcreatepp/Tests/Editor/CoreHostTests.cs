using System.Diagnostics;
using System.Text;
using Jcreatepp.Editor.Core;
using NUnit.Framework;
using UnityEngine;

namespace Jcreatepp.Editor.Preview.Tests
{
    /// <summary>
    /// EditMode tests (Window > General > Test Runner > EditMode): the block core bundle runs on the
    /// shipped Jint in this Unity, and how long it takes here (see the Console for the times).
    /// </summary>
    public sealed class CoreHostTests
    {
        const string Door =
            "{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_on_interact\",\"id\":\"ev\",\"x\":0,\"y\":0," +
            "\"inputs\":{\"DO\":{\"block\":{\"type\":\"jcreatepp_set_flag\",\"id\":\"f\",\"fields\":{\"FLAG_NAME\":\"open\",\"OPERATION\":\"toggle\"}," +
            "\"next\":{\"block\":{\"type\":\"jcreatepp_add_rotation\",\"id\":\"r\",\"inputs\":{" +
            "\"X\":{\"block\":{\"type\":\"math_number\",\"id\":\"x\",\"fields\":{\"NUM\":0}}}," +
            "\"Y\":{\"block\":{\"type\":\"math_number\",\"id\":\"y\",\"fields\":{\"NUM\":90}}}," +
            "\"Z\":{\"block\":{\"type\":\"math_number\",\"id\":\"z\",\"fields\":{\"NUM\":0}}}}}}}}}}]}}";

        static string Bundle()
        {
            var bundle = CoreBundle.Load();
            if (bundle == null) Assert.Fail("jcreatepp-core.txt not found");
            return bundle;
        }

        /// <summary>A chain of <paramref name="n"/> statements in one event (n levels of next).</summary>
        static string Chain(int n)
        {
            var open = new StringBuilder();
            var close = new StringBuilder();
            for (var i = 0; i < n; i++)
            {
                open.Append(i == 0 ? "{\"block\":{\"type\":\"jcreatepp_save_position\"" : ",\"next\":{\"block\":{\"type\":\"jcreatepp_save_position\"");
                close.Append("}}");
            }
            return "{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_on_interact\",\"inputs\":{\"DO\":" + open + close + "}}]}}";
        }

        [Test]
        public void ConvertsLikeTheWebEditor()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var r = core.Convert(Door);
                Assert.IsTrue(r.Ok, r.Error);
                CollectionAssert.IsEmpty(r.Errors);
                StringAssert.Contains("$.onInteract(", r.Code);
                StringAssert.Contains("// ── インタラクト時 ──", r.Code);
                StringAssert.Contains("\"MovableItem\"", r.SetupJson);
                Assert.AreEqual(1, r.Variables.Count);
                Assert.AreEqual("open", r.Variables[0].Name);
                StringAssert.Contains("/ 20,000 バイト", r.SizeText);
            }
        }

        [Test]
        public void WarnsRefusesAndAddsParts()
        {
            using (var core = new CoreHost(Bundle()))
            {
                var outside = core.Convert("{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_save_position\",\"id\":\"s\"}]}}");
                Assert.IsTrue(outside.Ok, outside.Error);
                Assert.AreEqual(1, outside.Warnings.Count);
                Assert.AreEqual("", outside.Warnings[0].EventId, "outside any event");

                var unknown = core.Convert("{\"blocks\":{\"languageVersion\":0,\"blocks\":[{\"type\":\"jcreatepp_future_block\"}]}}");
                Assert.IsFalse(unknown.Ok);
                StringAssert.Contains("Web 版", unknown.Error);

                var parts = core.Parts();
                Assert.IsTrue(parts.Count >= 4);
                foreach (var p in parts)
                {
                    var added = core.AddPart("{}", p.Id, "");
                    Assert.IsTrue(added.Ok, p.Id + ": " + added.Error);
                    Assert.IsTrue(core.Convert(added.Json).Ok, p.Id);
                }
                Assert.IsFalse(core.IsStopped);
            }
        }

        [Test]
        public void TimesInThisUnity()
        {
            var watch = Stopwatch.StartNew();
            using (var core = new CoreHost(Bundle()))
            {
                var load = watch.Elapsed.TotalMilliseconds;
                core.Convert(Door);
                var first = core.LastCallMilliseconds;
                var total = 0.0;
                for (var i = 0; i < 10; i++)
                {
                    core.Convert(Door);
                    total += core.LastCallMilliseconds;
                }
                var deep = core.Convert(Chain(149));
                Assert.IsTrue(deep.Ok, deep.Error);
                var deepMs = core.LastCallMilliseconds;
                UnityEngine.Debug.Log("Jcreate++ core times: load " + load.ToString("0") + " ms, first convert " + first.ToString("0") +
                                      " ms, then " + (total / 10).ToString("0.0") + " ms on average, 150 levels deep " + deepMs.ToString("0") + " ms");
                Assert.Less(load, CoreHost.LoadTimeout.TotalMilliseconds);
                Assert.Less(deepMs, CoreHost.CallTimeout.TotalMilliseconds);
            }
        }
    }
}
