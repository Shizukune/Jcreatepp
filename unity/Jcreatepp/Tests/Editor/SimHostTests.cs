using System.Diagnostics;
using Jcreatepp.Editor.Preview;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace Jcreatepp.Editor.Preview.Tests
{
    /// <summary>
    /// EditMode tests (Window > General > Test Runner > EditMode): the shipped Jint and simulator
    /// bundle work in this Unity, and the preview stops and recovers as designed.
    /// </summary>
    public sealed class SimHostTests
    {
        static readonly double[] Origin = { 0, 0, 0 };
        static readonly double[] NoTurn = { 0, 0, 0, 1 };

        static string Bundle()
        {
            foreach (var guid in AssetDatabase.FindAssets("jcreatepp-sim t:TextAsset"))
            {
                var asset = AssetDatabase.LoadAssetAtPath<TextAsset>(AssetDatabase.GUIDToAssetPath(guid));
                if (asset != null) return asset.text;
            }
            Assert.Fail("jcreatepp-sim.txt not found");
            return null;
        }

        [Test]
        public void RunsStartUpdateAndInteract()
        {
            using (var host = new SimHost(Bundle()))
            {
                var code = "$.onStart(() => { $.setPosition(new Vector3(0, 1, 0)); });" +
                           "$.onUpdate((dt) => { $.setRotation($.getRotation().multiply(new Quaternion().setFromEulerAngles(new Vector3(0, 90 * dt, 0)))); });" +
                           "$.onInteract(() => { $.state[\"var.n\"] = 1; });";
                Assert.AreEqual("", host.Load(code, Origin, NoTurn));
                Assert.AreEqual(1.0, host.TakeSnapshot().Position[1], 1e-9, "onStart ran");
                for (var i = 0; i < 60; i++) host.Step(1.0 / 60);
                Assert.AreEqual(90.0, host.TakeSnapshot().Euler[1], 1e-6, "90 degrees after 1 s");
                host.Fire("interact", "", "");
                var s = host.TakeSnapshot();
                CollectionAssert.AreEqual(new[] { "interact" }, s.Events);
                Assert.AreEqual("1", s.State[0].Text);
            }
        }

        [Test]
        public void StartsAtTheGivenPose()
        {
            using (var host = new SimHost(Bundle()))
            {
                host.Load("$.onUpdate(() => {});", new double[] { 1, 2, 3 }, new double[] { 0, 0.7071067811865476, 0, 0.7071067811865476 });
                var s = host.TakeSnapshot();
                Assert.AreEqual(new[] { 1.0, 2.0, 3.0 }, s.Position);
                Assert.AreEqual(90.0, s.Euler[1], 1e-6);
            }
        }

        [Test]
        public void SyntaxErrorIsReportedAndTheHostStaysUsable()
        {
            using (var host = new SimHost(Bundle()))
            {
                StringAssert.Contains("スクリプトを実行できません", host.Load("$.onStart(() => {", Origin, NoTurn));
                Assert.IsFalse(host.IsStopped);
                Assert.AreEqual("", host.Load("$.onUpdate(() => {});", Origin, NoTurn));
            }
        }

        [Test]
        public void EndlessLoopStopsWithinTheTimeLimitAndANewHostWorks()
        {
            using (var host = new SimHost(Bundle()))
            {
                host.Load("$.onUpdate(() => { while (true) {} });", Origin, NoTurn);
                var watch = Stopwatch.StartNew();
                host.Step(1.0 / 60);
                Assert.IsTrue(host.IsStopped, "stopped");
                Assert.Less(watch.Elapsed.TotalSeconds, SimHost.CallTimeout.TotalSeconds + 2);
                Assert.IsNull(host.TakeSnapshot());
            }
            using (var again = new SimHost(Bundle()))
            {
                Assert.AreEqual("", again.Load("$.onUpdate(() => {});", Origin, NoTurn));
            }
        }

        [Test]
        public void ErrorInOnStartIsKept()
        {
            using (var host = new SimHost(Bundle()))
            {
                Assert.AreEqual("", host.Load("$.onStart(() => { null.x; }); $.onUpdate(() => {});", Origin, NoTurn));
                host.Step(1.0 / 60);
                StringAssert.Contains("start", host.TakeSnapshot().LastError);
            }
        }

        [Test]
        public void PreviewWindowOpensAndClosesCleanly()
        {
            PreviewWindow.Open();
            var window = EditorWindow.GetWindow<PreviewWindow>();
            window.Close();
            Assert.Pass();
        }
    }
}
