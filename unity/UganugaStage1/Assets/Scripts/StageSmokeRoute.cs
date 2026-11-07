using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace Uganuga.UnityStageOne
{
    // Explicit opt-in native-player diagnostic, not a human keyboard playthrough.
    // Only controller actions are supplied; all collisions, damage, food, enemies and checkpoints remain real.
    [DefaultExecutionOrder(-100)]
    public sealed class StageSmokeRoute : MonoBehaviour
    {
        readonly Vector2[] route = {
            new Vector2(10.8f,3),new Vector2(19.5f,5.5f),new Vector2(33,5.5f),new Vector2(46,8),
            new Vector2(56,6),new Vector2(68,3.5f),new Vector2(80,3.5f),new Vector2(94,6.2f),
            new Vector2(104,6.2f),new Vector2(117,8.5f),new Vector2(129,6),new Vector2(142,3.2f),new Vector2(156,0)
        };
        StageOne stage;
        int waypoint,actions;
        float began,nextAttack,nextJump,holdJumpUntil,lastProgressTime,lastX;
        float nextDiagnosticLog;
        bool canopyCaptured,finished;
        static bool awaitingRestart;
        IEnumerator Start()
        {
            stage=StageOne.Instance; began=Time.unscaledTime; lastProgressTime=began;
            if(awaitingRestart)
            {
                awaitingRestart=false; finished=true; stage.Player.SetDiagnosticInput(0,0,false,false,false);
                yield return new WaitForSeconds(.3f);
                var reset=stage.Snapshot();
                bool valid=reset.food==0 && reset.hp==10 && reset.lives==3 && reset.trail==0 && !reset.cleared && !reset.gameOver;
                File.WriteAllText(Path.Combine(EvidencePath(),"restart-result.json"),JsonUtility.ToJson(reset,true));
                Debug.Log("UGANUGA_RESTART_VALIDATED " + valid);
                Application.Quit(valid?0:3); yield break;
            }
            Debug.Log("UGANUGA_SMOKE_START action-driver=true state-injection=false human-keyboard=false");
            yield return new WaitForSeconds(.7f);
            stage.CaptureEvidence("stage1-start");
        }
        void Update()
        {
            if(!stage || !stage.Player || finished) return;
            var player=stage.Player;
            Vector2 pos=player.transform.position;
            if(Time.unscaledTime>=nextDiagnosticLog)
            {
                nextDiagnosticLog=Time.unscaledTime+10;
                Debug.Log("UGANUGA_SMOKE_PROGRESS waypoint="+waypoint+" x="+pos.x+" y="+pos.y+" hp="+stage.Hp+" kills="+stage.Kills);
            }
            if(stage.Cleared || stage.GameOver || Time.unscaledTime-began>240)
            {
                finished=true; player.SetDiagnosticInput(0,0,false,false,false);
                StartCoroutine(FinishDiagnostic()); return;
            }
            if(Mathf.Abs(pos.x-lastX)>.5f) { lastProgressTime=Time.unscaledTime; lastX=pos.x; }
            if(waypoint>=route.Length) waypoint=route.Length-1;
            var target=route[waypoint];
            if(Mathf.Abs(pos.x-target.x)<1 && Mathf.Abs(pos.y-target.y)<.22f && !player.Climbing && player.Grounded && waypoint<route.Length-1)
            {
                Debug.Log("UGANUGA_SMOKE_WAYPOINT " + waypoint + " x=" + pos.x + " y=" + pos.y);
                waypoint++; target=route[waypoint];
            }
            if(!canopyCaptured && waypoint>=7) { canopyCaptured=true; stage.CaptureEvidence("stage1-canopy"); }
            // A fall/checkpoint recovery naturally rewinds the intended route, never the player state.
            if(waypoint>0 && pos.x<route[waypoint-1].x-5)
            {
                int candidate=0; while(candidate<route.Length-1 && route[candidate].x<pos.x-.6f) candidate++;
                waypoint=candidate; target=route[waypoint];
            }
            float x=Mathf.Abs(target.x-pos.x)>.28f?Mathf.Sign(target.x-pos.x):0;
            float y=0; bool jump=false,attack=false;
            if(target.y>pos.y+.25f && Mathf.Abs(target.x-pos.x)<.55f) { y=1; x=0; }
            if(player.Climbing) { y=1; x=0; }
            JungleEnemy threat=null;
            if(!player.Climbing)
            {
                foreach(var enemy in stage.Enemies)
                {
                    if(!enemy || enemy.Dead || Mathf.Abs(enemy.surface-pos.y)>1.15f || Mathf.Abs(enemy.transform.position.x-pos.x)>3.1f) continue;
                    if(!threat || Mathf.Abs(enemy.transform.position.x-pos.x)<Mathf.Abs(threat.transform.position.x-pos.x)) threat=enemy;
                }
            }
            if(threat)
            {
                float dx=threat.transform.position.x-pos.x;
                x=Mathf.Abs(dx)>1.35f?Mathf.Sign(dx):0;
                if(Mathf.Abs(dx)<2 && Time.time>nextAttack)
                {
                    if(player.Facing!=(dx>0?1:-1)) x=Mathf.Sign(dx);
                    attack=true; nextAttack=Time.time+.52f; actions++;
                }
                if(threat.Warning && player.Grounded && Time.time>nextJump) jump=true;
                y=0;
            }
            if(!threat && player.Grounded && Mathf.Abs(x)>.1f && Time.time>nextJump)
            {
                foreach(var surface in stage.Platforms)
                    if(Mathf.Abs(pos.y-surface.y)<.15f && pos.x>=surface.left && pos.x<=surface.right && target.x>surface.right+.2f && surface.right-pos.x<1.05f)
                    { jump=true; break; }
            }
            if(jump) { nextJump=Time.time+.7f; holdJumpUntil=Time.time+.30f; actions++; }
            if(Time.unscaledTime-lastProgressTime>12 && player.Grounded && Time.time>nextJump)
            { jump=true; holdJumpUntil=Time.time+.3f; nextJump=Time.time+.8f; lastProgressTime=Time.unscaledTime; }
            player.SetDiagnosticInput(x,y,jump,Time.time<holdJumpUntil,attack); actions++;
        }
        IEnumerator FinishDiagnostic()
        {
            var result=new DiagnosticResult{mode="native action-driver (not human keyboard)",stateInjection=false,waypoint=waypoint,actionFrames=actions,result=stage.Snapshot()};
            string path=EvidencePath();
            Directory.CreateDirectory(path); File.WriteAllText(Path.Combine(path,"smoke-result.json"),JsonUtility.ToJson(result,true));
            if(!stage.Cleared) stage.CaptureEvidence("stage1-diagnostic-end");
            Debug.Log("UGANUGA_SMOKE_END " + JsonUtility.ToJson(result));
            yield return new WaitForSecondsRealtime(1);
            if(stage.Cleared) { awaitingRestart=true; stage.RestartRun(); yield break; }
            Application.Quit(stage.Cleared?0:2);
        }
        string EvidencePath()
        {
            string path=null; foreach(var arg in Environment.GetCommandLineArgs()) if(arg.StartsWith("--evidence=")) path=arg.Substring(11);
            return string.IsNullOrEmpty(path)?Path.Combine(Application.persistentDataPath,"Evidence"):path;
        }
        [Serializable] sealed class DiagnosticResult
        {
            public string mode;
            public bool stateInjection;
            public int waypoint,actionFrames;
            public StageSnapshot result;
        }
    }
}

