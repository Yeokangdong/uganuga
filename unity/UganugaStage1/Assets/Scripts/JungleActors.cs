using UnityEngine;

namespace Uganuga.UnityStageOne
{
    public sealed class JungleEnemy : MonoBehaviour
    {
        public bool monkey,guardian;
        public float surface;
        public bool Dead { get; private set; }
        public bool Warning => !Dead && state==1;
        public bool Stunned => !Dead && state==3;
        public Vector2 VisualCenter => new Vector2(transform.position.x,surface+(monkey?1.05f:.3f));
        int hp,state,direction=1;
        float stateUntil,nextAttack,stunUntil,hitUntil,originalX;
        StageOne stage;
        SpriteRenderer visual;
        SpriteRenderer perch;
        void Start()
        {
            stage=StageOne.Instance; hp=guardian?4:2; originalX=transform.position.x;
            visual=gameObject.AddComponent<SpriteRenderer>(); visual.sortingOrder=8;
            if(monkey)
            {
                // The sprite pivot is its tail's attachment, exactly on this branch (not a free-floating line).
                transform.position=new Vector3(originalX,surface+2.35f,0);
                perch=stage.Picture("Monkey's connected overhead branch","branch",new Vector2(originalX+.6f,surface+2.35f),7);
                StageOne.Fit(perch,3.4f,.65f);
                var support=stage.Picture("Monkey perch trunk","vine",new Vector2(originalX+2,surface+1.15f),6);
                StageOne.Fit(support,.3f,2.5f);
            }
            nextAttack=Time.time+1.2f;
        }
        void Update()
        {
            if(Dead || !stage || stage.Paused || stage.Cleared || stage.GameOver) return;
            var player=stage.Player;
            float dx=player.transform.position.x-transform.position.x;
            bool level=Mathf.Abs(player.transform.position.y-surface)<1.1f;
            bool landingReady=!player.Climbing && (!player.Grounded || Time.time-player.LandedAt>.6f);
            if(Time.time<stunUntil) { state=3; }
            else if(state==3) { state=0; hp=1; nextAttack=Time.time+1; }
            if(state==0 && Time.time>nextAttack && Mathf.Abs(dx)<(monkey?11:4) && level && landingReady)
            {
                direction=dx>=0?1:-1; state=1; stateUntil=Time.time+(monkey?1.1f:.85f);
            }
            if(state==1)
            {
                if(!level || !landingReady) { state=0; nextAttack=Time.time+.5f; }
                else if(Time.time>=stateUntil)
                {
                    state=2; stateUntil=Time.time+(monkey?.4f:.34f);
                    if(monkey) ThrowCoconut();
                }
            }
            if(state==2 && !monkey)
            {
                transform.position+=Vector3.right*(direction*5.8f*Time.deltaTime);
                if(Mathf.Abs(player.transform.position.x-transform.position.x)<1.05f && Mathf.Abs(player.transform.position.y-surface)<1.15f)
                    stage.Damage(1,transform.position.x);
            }
            if(state==2 && Time.time>=stateUntil) { state=0; nextAttack=Time.time+(monkey?2.3f:1.9f); }
            if(!monkey && state==0) transform.position=new Vector3(Mathf.MoveTowards(transform.position.x,originalX,Time.deltaTime),surface,0);
            string key=monkey?(state==1?"monkey.windup":state==2?"monkey.throw":"monkey.idle"):"snake.idle";
            visual.sprite=stage.Art.Get(key,Time.time);
            // Authored sprites face right. Changing facing never changes scale or feet.
            visual.flipX=direction<0;
            visual.color=Time.time<hitUntil?new Color(1,.55f,.4f):state==3?new Color(.75f,.78f,1):Color.white;
        }
        void ThrowCoconut()
        {
            var obj=new GameObject("Horizontal coconut"); obj.transform.SetParent(stage.World);
            obj.transform.position=new Vector2(transform.position.x+direction*.5f,surface+1.0f);
            var coconut=obj.AddComponent<Coconut>(); coconut.direction=direction; coconut.owner=this;
        }
        public void Hit(int facing)
        {
            if(Dead || Time.time<hitUntil) return;
            hitUntil=Time.time+.25f;
            if(state==3) { Die(); return; }
            hp--; stage.Float("HIT",VisualCenter,Color.white);
            if(hp<=0) { state=3; stunUntil=Time.time+3.2f; stage.Say("기절했다! 한 번 더 때리면 먹이를 얻습니다.",2); }
            else { state=0; nextAttack=Time.time+1.3f; }
        }
        void Die()
        {
            Dead=true; visual.enabled=false; stage.Kills++;
            stage.SpawnPickup(new Vector2(transform.position.x,surface+.015f),guardian?40:20);
            stage.Float(guardian?"길이 열렸다":"먹이 발견",new Vector2(transform.position.x,surface+1),new Color(1,.8f,.3f));
            if(guardian) stage.Say("쉼터가 안전해졌다! 오른쪽 입구로 가세요.");
        }
    }

    public sealed class Coconut : MonoBehaviour
    {
        public int direction;
        public JungleEnemy owner;
        float remaining=3;
        SpriteRenderer visual;
        void Start()
        {
            visual=gameObject.AddComponent<SpriteRenderer>(); visual.sprite=StageOne.Instance.Art.Frame("coconut"); visual.sortingOrder=9;
            StageOne.FitHeight(visual,.38f);
        }
        void Update()
        {
            var stage=StageOne.Instance;
            if(stage.Paused || stage.Cleared || stage.GameOver) return;
            if(!owner || owner.Dead || owner.Stunned) { Destroy(gameObject); return; }
            transform.position+=Vector3.right*(direction*7.2f*Time.deltaTime); remaining-=Time.deltaTime;
            var feet=stage.Player.transform.position;
            if(Mathf.Abs(transform.position.x-feet.x)<.48f && transform.position.y>feet.y+.2f && transform.position.y<feet.y+1.5f)
            { stage.Damage(1,transform.position.x); Destroy(gameObject); }
            else if(remaining<=0) Destroy(gameObject);
        }
    }

    public sealed class FoodPickup : MonoBehaviour
    {
        public int amount;
        StageOne stage;
        void Start()
        {
            stage=StageOne.Instance;
            var renderer=gameObject.AddComponent<SpriteRenderer>(); renderer.sprite=stage.Art.Frame(amount==5?"fruit":"meat"); renderer.sortingOrder=4;
            StageOne.FitHeight(renderer,amount==5?.48f:.62f);
        }
        void Update()
        {
            if(!stage || stage.Paused || stage.Cleared || stage.GameOver) return;
            var feet=stage.Player.transform.position;
            if(Mathf.Abs(feet.x-transform.position.x)<.75f && transform.position.y>feet.y-.1f && transform.position.y<feet.y+1.65f)
            { stage.AddFood(amount,transform.position); Destroy(gameObject); }
        }
    }
    public sealed class TrailMarker : MonoBehaviour
    {
        public int index;
        void Update()
        {
            var stage=StageOne.Instance;
            if(stage && Mathf.Abs(stage.Player.transform.position.x-transform.position.x)<1.5f && Mathf.Abs(stage.Player.transform.position.y-(transform.position.y-1.6f))<1)
                stage.ReachTrail(index,new Vector2(transform.position.x,transform.position.y-1.6f));
        }
    }
    public sealed class ShelterExit : MonoBehaviour
    {
        void OnTriggerEnter2D(Collider2D other) { if(other.GetComponent<UgaController>()) StageOne.Instance.Finish(); }
        void OnTriggerStay2D(Collider2D other) { if(other.GetComponent<UgaController>()) StageOne.Instance.Finish(); }
    }
}



