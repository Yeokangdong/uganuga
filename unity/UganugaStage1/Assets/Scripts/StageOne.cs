using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Uganuga.UnityStageOne
{
    // All geometry and rules belong to this isolated Unity prototype. The web game is read-only.
    public sealed class StageOne : MonoBehaviour
    {
        public static StageOne Instance { get; private set; }
        public StageArt Art { get; private set; }
        public UgaController Player { get; private set; }
        public readonly List<JungleEnemy> Enemies = new List<JungleEnemy>();
        public readonly List<Vine> Vines = new List<Vine>();
        public readonly List<Platform> Platforms = new List<Platform>();
        public int Food { get; private set; }
        public int Hp { get; private set; } = 10;
        public int Lives { get; private set; } = 3;
        public bool Paused { get; private set; }
        public bool Cleared { get; private set; }
        public bool GameOver { get; private set; }
        public int Trail { get; private set; }
        public string Notice { get; private set; } = "누가가 남긴 리본을 따라 나무 위로 올라가자";
        public float NoticeUntil { get; private set; } = 8;
        public int Attacks, Kills, Climbs, Jumps, Falls, DamageTaken;
        public float Elapsed { get; private set; }
        public Vector2 Checkpoint { get; private set; } = new Vector2(1.5f, 0.1f);
        public Transform World { get; private set; }
        Camera view;
        float goalX = 156;
        float currentSection;
        float shake;
        Font font;
        Texture2D white;
        GUIStyle label, big, small;
        AudioSource audioSource;
        AudioClip hitTone, foodTone, jumpTone;
        readonly List<ParallaxPanel> backgroundPanels = new List<ParallaxPanel>();
        readonly List<FloatingText> floatingTexts = new List<FloatingText>();
        string evidencePath;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoStart()
        {
            if (!FindFirstObjectByType<StageOne>()) new GameObject("Uganuga Stage 1").AddComponent<StageOne>();
        }

        void Awake()
        {
            if (Instance && Instance != this) { enabled = false; return; }
            Instance = this;
            Application.targetFrameRate = 60;
            QualitySettings.vSyncCount = 1;
            Physics2D.gravity = new Vector2(0, -28);
            Art = new StageArt(); Art.Load();
            white = Texture2D.whiteTexture;
            font = Font.CreateDynamicFontFromOSFont(new[] { "Malgun Gothic", "맑은 고딕", "Arial" }, 22);
            audioSource = gameObject.AddComponent<AudioSource>();
            audioSource.volume = 0.18f;
            hitTone = MakeTone(160, .09f); foodTone = MakeTone(740, .09f); jumpTone = MakeTone(340, .06f);
            view = new GameObject("Jungle Camera").AddComponent<Camera>();
            view.orthographic = true; view.orthographicSize = 5.6f;
            view.backgroundColor = new Color(.09f, .19f, .12f);
            view.transform.position = new Vector3(6, 3.3f, -10);
            new GameObject("Audio Listener").AddComponent<AudioListener>();
            foreach (var arg in Environment.GetCommandLineArgs())
                if (arg.StartsWith("--evidence=")) evidencePath = arg.Substring("--evidence=".Length);
            BuildWorld();
            if(Array.IndexOf(Environment.GetCommandLineArgs(),"--smoke")>=0) gameObject.AddComponent<StageSmokeRoute>();
            Debug.Log("UGANUGA_READY Stage1 Unity; arrows/WASD move-climb; Z/Space jump; X/J attack; P pause; R restart");
        }

        void BuildWorld()
        {
            World = new GameObject("Stage 1 - Nuga's jungle trail").transform;
            // Continuous close jungle; overlapping panels are opaque, so there are no crossfade ghosts.
            for (int i = -2; i < 12; i++)
            {
                var renderer = Picture("Close jungle " + i, "background" + (Math.Abs(i) % 3 + 1), new Vector2(i * 18, 0), -30);
                Fit(renderer, 18.2f, 12.8f);
                backgroundPanels.Add(new ParallaxPanel { renderer = renderer, x = i * 18 });
            }
            // Short supported ground islands; branches and forgiving vines carry most of the route.
            Ground(-3, 13, 0); Ground(48, 56, 0); Ground(100, 108, 0); Ground(140, 158, 0);
            Branch(8, 20, 3); Branch(18, 30, 5.5f); Branch(31.5f, 47, 5.5f);
            Branch(42, 53, 8); Branch(54.5f, 66, 6); Branch(65, 77, 3.5f);
            Branch(78.5f, 95, 3.5f); Branch(88, 101, 6.2f); Branch(102.5f, 118, 6.2f);
            Branch(113, 126, 8.5f); Branch(127.5f, 140, 6); Branch(138, 150, 3.2f);
            // Lower catch branches are connected back to the main route, never dead-end pits.
            Branch(26, 35, 1.5f, true); Branch(49, 58, 2.5f, true);
            Branch(73, 82, .5f, true); Branch(97, 106, 2.2f, true);
            Branch(122, 131, 3, true);
            AddVine(10.8f, .0f, 3); AddVine(19.5f, 3, 5.5f); AddVine(33, 1.5f, 5.5f);
            AddVine(46, 5.5f, 8); AddVine(56, 2.5f, 6); AddVine(65.3f, 3.5f, 6);
            AddVine(80, .5f, 3.5f); AddVine(94, 3.5f, 6.2f); AddVine(104, 2.2f, 6.2f);
            AddVine(117, 6.2f, 8.5f); AddVine(129, 3, 6); AddVine(142, 0, 3.2f);
            foreach (float x in new[] { 5f, 52f, 104f, 147f })
            {
                var tree = Picture("Rooted jungle tree", x == 52 || x == 147 ? "tree2" : "tree1", new Vector2(x, 0), -4);
                float h = tree.sprite ? tree.sprite.bounds.size.y : 10;
                float treeScale = 11.5f / Mathf.Max(h, .01f);
                if ((x == 52 || x == 104) && tree.sprite) treeScale = Mathf.Min(treeScale,6.7f/tree.sprite.bounds.size.x);
                tree.transform.localScale = Vector3.one * treeScale;
            }
            // Trees over gaps descend below the frame. Their roots are never suspended in empty air.
            for (int i = 0; i < 7; i++)
            {
                float x = 23 + i * 18;
                var tree = Picture("Canopy trunk", i % 2 == 0 ? "tree1" : "tree2", new Vector2(x, -9), -8);
                float h = tree.sprite ? tree.sprite.bounds.size.y : 10;
                tree.transform.localScale = Vector3.one * (23 / Mathf.Max(h, .01f));
            }
            foreach (var spot in new[] { new Vector2(7,0), new Vector2(16,3), new Vector2(26,5.5f), new Vector2(38,5.5f),
                new Vector2(50,8), new Vector2(60,6), new Vector2(73,3.5f), new Vector2(86,3.5f),
                new Vector2(98,6.2f), new Vector2(110,6.2f), new Vector2(123,8.5f), new Vector2(134,6), new Vector2(146,3.2f) })
                SpawnPickup(spot + Vector2.up * .015f, 5);
            SpawnEnemy(25, 5.5f, false); SpawnEnemy(37, 5.5f, true);
            SpawnEnemy(59, 6, false); SpawnEnemy(72, 3.5f, true);
            SpawnEnemy(85, 3.5f, false); SpawnEnemy(109, 6.2f, true);
            SpawnEnemy(121, 8.5f, false); SpawnEnemy(135, 6, true);
            SpawnEnemy(152, 0, false, true);
            CreateTrail(new Vector2(49,8), 1);
            CreateTrail(new Vector2(96,6.2f), 2);
            CreateTrail(new Vector2(145,3.2f), 3);
            var goal = Picture("Nuga's shelter - stage exit", "goal", new Vector2(goalX, 0), 2);
            FitHeight(goal, 3.2f);
            // Wide visible exit beacon; entering it is the finish trigger, no invisible food quota.
            var exit = new GameObject("Shelter entrance"); exit.transform.SetParent(World);
            exit.transform.position = new Vector3(goalX, 1, 0);
            exit.AddComponent<BoxCollider2D>().size = new Vector2(2.2f, 2.4f);
            exit.GetComponent<BoxCollider2D>().isTrigger = true;
            exit.AddComponent<ShelterExit>();
            var playerObject = new GameObject("Uga"); playerObject.transform.position = Checkpoint;
            Player = playerObject.AddComponent<UgaController>();
        }

        public SpriteRenderer Picture(string name, string key, Vector2 position, int order)
        {
            var obj = new GameObject(name); obj.transform.SetParent(World);
            obj.transform.position = position;
            var renderer = obj.AddComponent<SpriteRenderer>(); renderer.sprite = Art.Frame(key); renderer.sortingOrder = order;
            return renderer;
        }
        public static void Fit(SpriteRenderer renderer, float width, float height)
        {
            if (!renderer.sprite) return;
            var size = renderer.sprite.bounds.size;
            renderer.transform.localScale = new Vector3(width / size.x, height / size.y, 1);
        }
        public static void FitHeight(SpriteRenderer renderer, float height)
        {
            if (renderer.sprite) renderer.transform.localScale = Vector3.one * (height / renderer.sprite.bounds.size.y);
        }
        void Ground(float left, float right, float y)
        {
            var top = Picture("Ground island", "branch", new Vector2((left+right)*.5f, y), 0);
            Fit(top, right-left, .7f);
            var earth = Picture("Supported jungle earth", "ground1", new Vector2((left+right)*.5f,y-.55f), -1);
            Fit(earth, right-left, 8);
            var obj = new GameObject("Ground collider"); obj.transform.SetParent(World); obj.transform.position = new Vector3((left+right)*.5f,y-.35f,0);
            obj.AddComponent<BoxCollider2D>().size = new Vector2(right-left,.7f);
            Platforms.Add(new Platform(left,right,y));
        }
        void Branch(float left, float right, float y, bool catchBranch = false)
        {
            var top = Picture(catchBranch ? "Recovery branch" : "Canopy route", "branch", new Vector2((left+right)*.5f,y), 0);
            Fit(top, right-left, .9f);
            var obj = new GameObject("One-way branch"); obj.transform.SetParent(World);
            obj.transform.position = new Vector3((left+right)*.5f,y-.16f,0);
            var box = obj.AddComponent<BoxCollider2D>(); box.size = new Vector2(right-left,.32f); box.usedByEffector = true;
            var effector = obj.AddComponent<PlatformEffector2D>(); effector.useOneWay = true; effector.surfaceArc = 150;
            Platforms.Add(new Platform(left,right,y));
        }
        void AddVine(float x, float bottom, float top)
        {
            var visual = Picture("Climbable vine", "vine", new Vector2(x,(bottom+top)*.5f), 3);
            Fit(visual,.18f,top-bottom+1.5f);
            Vines.Add(new Vine { x=x, bottom=bottom, top=top });
        }
        void CreateTrail(Vector2 position, int index)
        {
            var obj = new GameObject("Nuga ribbon " + index); obj.transform.SetParent(World); obj.transform.position = position + Vector2.up*1.6f;
            var visualObject = new GameObject("Trail marker on branch"); visualObject.transform.SetParent(obj.transform); visualObject.transform.localPosition = Vector3.down*1.6f;
            var visual = visualObject.AddComponent<SpriteRenderer>(); visual.sprite = Art.Frame("ribbon");
            if (!visual.sprite) visual.sprite = Art.Frame("goal");
            FitHeight(visual,.6f); visual.sortingOrder=5;
            obj.AddComponent<TrailMarker>().index = index;
        }
        void SpawnEnemy(float x, float surface, bool monkey, bool guardian=false)
        {
            var obj = new GameObject(guardian ? "Shelter guardian" : monkey ? "Hanging monkey" : "Branch snake");
            obj.transform.SetParent(World); obj.transform.position = new Vector3(x,surface,0);
            var enemy = obj.AddComponent<JungleEnemy>(); enemy.monkey=monkey; enemy.surface=surface; enemy.guardian=guardian;
            Enemies.Add(enemy);
        }
        public void SpawnPickup(Vector2 position, int amount)
        {
            var obj = new GameObject(amount==5 ? "Fruit on branch" : "Food reward"); obj.transform.SetParent(World); obj.transform.position=position;
            var pickup = obj.AddComponent<FoodPickup>(); pickup.amount=amount;
        }
        public void AddFood(int amount, Vector2 where)
        {
            Food += amount; if(amount>=20) Hp=Mathf.Min(10,Hp+2);
            Float("+"+amount+" FOOD", where, new Color(1,.87f,.39f));
            Sound("food");
        }
        public void Say(string text, float seconds=4) { Notice=text; NoticeUntil=Time.unscaledTime+seconds; }
        public void Float(string text, Vector2 at, Color color) { floatingTexts.Add(new FloatingText{text=text,position=at,color=color,until=Time.time+1.1f}); }
        public void Sound(string kind) { audioSource.PlayOneShot(kind=="food"?foodTone:kind=="jump"?jumpTone:hitTone); }
        public void Damage(int amount, float sourceX)
        {
            if (Cleared || GameOver || Player.Invulnerable) return;
            Hp-=amount; DamageTaken+=amount; shake=.16f; Sound("hit");
            Player.TakeKnockback(sourceX);
            if (Hp<=0) LoseLife();
        }
        void LoseLife()
        {
            Lives--; if(Lives<=0) { GameOver=true; Say("모험은 끝나지 않았다. R을 눌러 다시 도전하세요.",999); return; }
            Hp=10; Player.Respawn(Checkpoint); Say("리본에서 다시 시작! 모은 먹이 점수는 유지됩니다.");
        }
        public void Fall()
        {
            Falls++; Hp-=2;
            if(Hp<=0) LoseLife(); else { Player.Respawn(Checkpoint); Say("아래쪽으로 떨어졌습니다. 덩굴을 타고 다시 올라가세요."); }
        }
        public void ReachTrail(int index, Vector2 at)
        {
            if(index<=Trail) return;
            Trail=index; Checkpoint=new Vector2(at.x-1,at.y+.1f);
            Say(index==3 ? "새 발자국이다! 오른쪽 아래 쉼터를 확인하자." : "누가의 리본 발견! 다시 시작할 위치를 저장했습니다.");
            Float("리본 발견",at+Vector2.up,Color.white);
        }
        public void Finish()
        {
            if(Cleared || GameOver) return;
            foreach(var enemy in Enemies) if(enemy && enemy.guardian && !enemy.Dead) { Say("쉼터 앞 뱀이 길을 막고 있습니다. 몽둥이로 물리치세요!"); return; }
            Cleared=true; Say("누가의 새 발자국을 찾았다! 정글 너머로 모험은 계속된다.",999);
            Debug.Log("UGANUGA_STAGE_CLEAR " + JsonUtility.ToJson(Snapshot())); SaveEvidence();
        }
        void Update()
        {
            if(Input.GetKeyDown(KeyCode.P) || Input.GetKeyDown(KeyCode.Escape)) { Paused=!Paused; Time.timeScale=Paused?0:1; }
            if(Input.GetKeyDown(KeyCode.R)) RestartRun();
            if(!Paused && !Cleared && !GameOver) Elapsed+=Time.deltaTime;
            if(Input.GetKeyDown(KeyCode.F9)) SaveEvidence();
            for(int i=floatingTexts.Count-1;i>=0;i--) if(floatingTexts[i].until<Time.time) floatingTexts.RemoveAt(i);
        }
        public void RestartRun()
        {
            Time.timeScale=1;
            UnityEngine.SceneManagement.SceneManager.LoadScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene().buildIndex);
        }
        void LateUpdate()
        {
            if(!Player) return;
            var playerPos=Player.transform.position;
            float targetX=Mathf.Clamp(playerPos.x+2.8f,6,148);
            float targetY=Mathf.Max(3.3f,playerPos.y+2.2f);
            var desired=new Vector3(targetX,targetY,-10);
            view.transform.position=Vector3.Lerp(view.transform.position,desired,1-Mathf.Exp(-5*Time.unscaledDeltaTime));
            if(shake>0) { shake-=Time.unscaledDeltaTime; view.transform.position+=new Vector3(Mathf.Sin(Time.unscaledTime*80)*shake,0,0); }
            foreach(var panel in backgroundPanels)
            {
                panel.renderer.transform.position=new Vector3(panel.x+view.transform.position.x*.22f, view.transform.position.y, 0);
            }
            currentSection=Mathf.Clamp01(playerPos.x/goalX);
        }
        void InitStyles()
        {
            if(label!=null) return;
            label=new GUIStyle(GUI.skin.label){font=font,fontSize=22,fontStyle=FontStyle.Bold,normal={textColor=new Color(1,.95f,.77f)}};
            big=new GUIStyle(label){fontSize=36,alignment=TextAnchor.MiddleCenter};
            small=new GUIStyle(label){fontSize=16};
        }
        void DrawText(Rect rect,string text,GUIStyle style,Color? tint=null)
        {
            var old=GUI.color; GUI.color=new Color(.13f,.07f,.025f,.95f);
            GUI.Label(new Rect(rect.x+2,rect.y+2,rect.width,rect.height),text,style);
            GUI.color=tint??Color.white; GUI.Label(rect,text,style); GUI.color=old;
        }
        void Box(Rect rect,Color color) { var old=GUI.color; GUI.color=color; GUI.DrawTexture(rect,white); GUI.color=old; }
        void OnGUI()
        {
            InitStyles(); float scale=Mathf.Min(Screen.width/1280f,Screen.height/720f);
            GUI.matrix=Matrix4x4.TRS(Vector3.zero,Quaternion.identity,new Vector3(scale,scale,1));
            float width=Screen.width/scale,height=Screen.height/scale;
            Box(new Rect(18,18,455,89),new Color(.17f,.085f,.035f,.92f));
            Box(new Rect(18,18,455,3),new Color(.74f,.47f,.18f));
            DrawText(new Rect(34,29,310,38),"FOOD  "+Food.ToString("0000000"),label);
            DrawText(new Rect(34,71,65,25),"HP",small);
            for(int i=0;i<10;i++) Box(new Rect(67+i*17,77,14,10),i<Hp?new Color(.96f,.41f,.19f):new Color(.27f,.20f,.12f));
            DrawText(new Rect(259,70,195,28),"LIFE "+Lives+"    CLUB",small);
            Box(new Rect(width-304,18,286,67),new Color(.12f,.18f,.095f,.9f));
            DrawText(new Rect(width-285,28,260,30),"누가의 발자국",label);
            Box(new Rect(width-283,65,244,5),new Color(.20f,.29f,.13f));
            Box(new Rect(width-283,65,244*currentSection,5),new Color(1,.73f,.28f));
            if(Time.unscaledTime<NoticeUntil) {
                Box(new Rect(width*.5f-340,116,680,43),new Color(.08f,.13f,.07f,.83f));
                var textStyle=new GUIStyle(small){alignment=TextAnchor.MiddleCenter};
                DrawText(new Rect(width*.5f-330,122,660,30),Notice,textStyle);
            }
            var foot=Player?Player.transform.position:Vector3.zero;
            string hint = foot.x<13 ? "이동: 방향키 / A D    점프: Z / 스페이스    공격: X / J    덩굴: 위아래"
                : Player && Player.Climbing ? "위: 가지까지 올라가기    아래: 내려가기    좌우: 가지로 이동    Z: 뛰어내리기"
                : "리본과 가지 위 열매를 따라가세요    P: 일시정지    R: 처음부터";
            Box(new Rect(width*.5f-410,height-43,820,29),new Color(.08f,.13f,.07f,.78f));
            DrawText(new Rect(width*.5f-405,height-40,810,25),hint,new GUIStyle(small){fontSize=14,alignment=TextAnchor.MiddleCenter});
            foreach(var enemy in Enemies)
            {
                if(!enemy || enemy.Dead || (!enemy.Warning && !enemy.Stunned)) continue;
                var point=view.WorldToScreenPoint(enemy.VisualCenter+Vector2.up*.9f);
                if(point.z>0) DrawText(new Rect(point.x/scale-20,(Screen.height-point.y)/scale-25,40,45),enemy.Stunned?"★":"!",big,enemy.Stunned?new Color(.55f,.85f,1):new Color(1,.47f,.16f));
            }
            foreach(var text in floatingTexts)
            {
                var point=view.WorldToScreenPoint(text.position+Vector2.up*(1.1f-(text.until-Time.time)));
                DrawText(new Rect(point.x/scale-90,(Screen.height-point.y)/scale-15,180,30),text.text,new GUIStyle(small){alignment=TextAnchor.MiddleCenter},text.color);
            }
            if(Paused || Cleared || GameOver)
            {
                Box(new Rect(0,0,width,height),new Color(.025f,.07f,.04f,.72f));
                Box(new Rect(width*.5f-300,height*.5f-130,600,260),new Color(.20f,.11f,.045f,.96f));
                DrawText(new Rect(width*.5f-280,height*.5f-105,560,65),Cleared?"정글 1판 완료":GameOver?"다시 모험을 떠나자":"잠시 쉬는 중",big);
                DrawText(new Rect(width*.5f-270,height*.5f-25,540,48),Cleared?"FOOD "+Food+"   |   누가의 흔적을 찾았습니다!":GameOver?"리본을 따라 다시 도전해 보세요.":"정글 나무 그늘에서 잠시 쉬어가세요.",new GUIStyle(small){alignment=TextAnchor.MiddleCenter});
                DrawText(new Rect(width*.5f-270,height*.5f+52,540,38),Paused?"P / ESC: 계속하기     R: 처음부터":"R: 다시 플레이",new GUIStyle(label){alignment=TextAnchor.MiddleCenter});
            }
        }
        public StageSnapshot Snapshot() => new StageSnapshot{food=Food,hp=Hp,lives=Lives,trail=Trail,elapsed=Elapsed,cleared=Cleared,gameOver=GameOver,attacks=Attacks,kills=Kills,climbs=Climbs,jumps=Jumps,falls=Falls,damage=DamageTaken,playerX=Player?Player.transform.position.x:0,playerY=Player?Player.transform.position.y:0};
        public void SaveEvidence() { CaptureEvidence(Cleared?"stage1-clear":"stage1"); }
        public void CaptureEvidence(string name)
        {
            string folder=string.IsNullOrEmpty(evidencePath)?Path.Combine(Application.persistentDataPath,"Evidence"):evidencePath;
            Directory.CreateDirectory(folder);
            File.WriteAllText(Path.Combine(folder,"stage1-result.json"),JsonUtility.ToJson(Snapshot(),true));
            if(Application.isBatchMode)
            {
                // Batch players skip normal screen rendering. Render the real game camera explicitly.
                // This image contains the world only; IMGUI HUD is not part of a camera render target.
                var previous=RenderTexture.active;
                var target=RenderTexture.GetTemporary(1280,720,24,RenderTextureFormat.ARGB32);
                var oldTarget=view.targetTexture;
                view.targetTexture=target; view.Render(); RenderTexture.active=target;
                var image=new Texture2D(1280,720,TextureFormat.RGB24,false);
                image.ReadPixels(new Rect(0,0,1280,720),0,0); image.Apply();
                File.WriteAllBytes(Path.Combine(folder,name+".png"),image.EncodeToPNG());
                view.targetTexture=oldTarget; RenderTexture.active=previous;
                RenderTexture.ReleaseTemporary(target); Destroy(image);
            }
            else ScreenCapture.CaptureScreenshot(Path.Combine(folder,name+".png"));
            Debug.Log("UGANUGA_EVIDENCE " + folder);
        }
        AudioClip MakeTone(float frequency,float length)
        {
            int count=(int)(22050*length); var samples=new float[count];
            for(int i=0;i<count;i++) samples[i]=Mathf.Sin(i*frequency*Mathf.PI*2/22050)*(1f-i/(float)count)*.45f;
            var clip=AudioClip.Create("Jungle cue",count,1,22050,false); clip.SetData(samples,0); return clip;
        }
        void OnDestroy() { if(Instance==this) { Instance=null; Time.timeScale=1; } }
        sealed class ParallaxPanel { public SpriteRenderer renderer; public float x; }
        sealed class FloatingText { public string text; public Vector2 position; public Color color; public float until; }
    }

    [Serializable] public sealed class StageSnapshot
    {
        public int food,hp,lives,trail,attacks,kills,climbs,jumps,falls,damage;
        public float elapsed,playerX,playerY;
        public bool cleared,gameOver;
    }
    public struct Platform
    {
        public float left,right,y;
        public Platform(float left,float right,float y) { this.left=left;this.right=right;this.y=y; }
    }
    public sealed class Vine { public float x,bottom,top; }
}





