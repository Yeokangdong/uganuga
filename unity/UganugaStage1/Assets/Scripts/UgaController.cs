using UnityEngine;

namespace Uganuga.UnityStageOne
{
    [RequireComponent(typeof(Rigidbody2D),typeof(CapsuleCollider2D),typeof(SpriteRenderer))]
    public sealed class UgaController : MonoBehaviour
    {
        public bool Climbing { get; private set; }
        public bool Grounded { get; private set; }
        public bool Invulnerable => Time.time < invulnerableUntil;
        public int Facing { get; private set; } = 1;
        public float LandedAt { get; private set; }
        Rigidbody2D body;
        CapsuleCollider2D capsule;
        SpriteRenderer visual;
        StageOne stage;
        Vine vine;
        float horizontal,vertical,lastGrounded,jumpBuffered,attackUntil,nextAttack,attackHitAt,invulnerableUntil;
        float knockbackUntil,walkPhase,climbPhase,lastX,lastY;
        bool pendingHit,jumpHeld,jumpRequest;
        public bool DiagnosticInput { get; private set; }
        float diagnosticHorizontal,diagnosticVertical;
        bool diagnosticJumpTap,diagnosticJumpHeld,diagnosticAttackTap;

        // Diagnostic actions use the same movement/attack code. They never move a transform or change HP/score.
        public void SetDiagnosticInput(float x,float y,bool jumpTap,bool holdJump,bool attackTap)
        {
            DiagnosticInput=true; diagnosticHorizontal=x; diagnosticVertical=y;
            diagnosticJumpTap=jumpTap; diagnosticJumpHeld=holdJump; diagnosticAttackTap=attackTap;
        }

        void Awake()
        {
            stage=StageOne.Instance;
            body=GetComponent<Rigidbody2D>(); body.freezeRotation=true; body.gravityScale=1;
            body.collisionDetectionMode=CollisionDetectionMode2D.Continuous;
            body.interpolation=RigidbodyInterpolation2D.Interpolate;
            capsule=GetComponent<CapsuleCollider2D>(); capsule.size=new Vector2(.62f,1.48f); capsule.offset=new Vector2(0,.76f);
            var material=new PhysicsMaterial2D("Uga no friction"){friction=0,bounciness=0}; capsule.sharedMaterial=material;
            visual=GetComponent<SpriteRenderer>(); visual.sortingOrder=10;
            lastX=transform.position.x; lastY=transform.position.y;
        }

        void Update()
        {
            if(stage.Paused) return;
            if(stage.Cleared || stage.GameOver) { body.linearVelocity=Vector2.zero; return; }
            horizontal=DiagnosticInput?diagnosticHorizontal:(Input.GetKey(KeyCode.RightArrow)||Input.GetKey(KeyCode.D)?1:0)-(Input.GetKey(KeyCode.LeftArrow)||Input.GetKey(KeyCode.A)?1:0);
            vertical=DiagnosticInput?diagnosticVertical:(Input.GetKey(KeyCode.UpArrow)||Input.GetKey(KeyCode.W)?1:0)-(Input.GetKey(KeyCode.DownArrow)||Input.GetKey(KeyCode.S)?1:0);
            jumpHeld=DiagnosticInput?diagnosticJumpHeld:Input.GetKey(KeyCode.Space)||Input.GetKey(KeyCode.Z);
            bool jumpTap=DiagnosticInput?diagnosticJumpTap:Input.GetKeyDown(KeyCode.Space)||Input.GetKeyDown(KeyCode.Z);
            bool attackTap=DiagnosticInput?diagnosticAttackTap:Input.GetKeyDown(KeyCode.X)||Input.GetKeyDown(KeyCode.J);
            if(jumpTap) { jumpBuffered=Time.time+.14f; jumpRequest=true; }
            if(attackTap && Time.time>=nextAttack && !Climbing)
            {
                attackUntil=Time.time+.42f; nextAttack=Time.time+.48f; attackHitAt=Time.time+.12f; pendingHit=true; stage.Attacks++;
                stage.Sound("hit");
            }
            if(pendingHit && Time.time>=attackHitAt)
            {
                pendingHit=false;
                foreach(var enemy in stage.Enemies)
                {
                    if(!enemy || enemy.Dead) continue;
                    Vector2 delta=enemy.VisualCenter-((Vector2)transform.position+Vector2.up*.85f);
                    if(Mathf.Abs(delta.y)<1.35f && Mathf.Abs(delta.x)<2.1f && delta.x*Facing>-.38f)
                        enemy.Hit(Facing);
                }
            }
            if(Mathf.Abs(horizontal)>.1f && Time.time>=knockbackUntil) Facing=horizontal>0?1:-1;
            UpdateAnimation();
        }

        void FixedUpdate()
        {
            if(stage.Paused || stage.Cleared || stage.GameOver) return;
            float y=transform.position.y;
            bool groundNow=false;
            foreach(var surface in stage.Platforms)
                if(transform.position.x>surface.left-.18f && transform.position.x<surface.right+.18f && Mathf.Abs(y-surface.y)<.13f && body.linearVelocity.y<=.7f) { groundNow=true; break; }
            if(groundNow && !Grounded) LandedAt=Time.time;
            Grounded=groundNow && !Climbing;
            if(Grounded) lastGrounded=Time.time;

            if(!Climbing && Mathf.Abs(vertical)>.1f && Time.time>=knockbackUntil)
            {
                Vine candidate=null; float nearest=.85f;
                foreach(var option in stage.Vines)
                {
                    float distance=Mathf.Abs(transform.position.x-option.x);
                    if(distance<nearest && y>=option.bottom-.25f && y<=option.top+.25f && (vertical>0 || y>option.bottom+.4f))
                    { candidate=option; nearest=distance; }
                }
                if(candidate!=null) BeginClimb(candidate);
            }
            if(Climbing)
            {
                if(jumpRequest)
                {
                    EndClimb(); body.linearVelocity=new Vector2(Facing*5.8f,10.5f); jumpBuffered=0; jumpRequest=false; stage.Jumps++;
                }
                else
                {
                    Vector2 pos=body.position;
                    pos.x=Mathf.MoveTowards(pos.x,vine.x,12*Time.fixedDeltaTime);
                    pos.y=Mathf.Clamp(pos.y+vertical*3.5f*Time.fixedDeltaTime,vine.bottom,vine.top+.04f);
                    body.MovePosition(pos);
                    if(pos.y>=vine.top-.01f && (Mathf.Abs(horizontal)>.1f || vertical>0))
                    {
                        float exitX=pos.x+(Mathf.Abs(horizontal)>.1f?horizontal*.5f:Facing*.48f);
                        float exitY=vine.top+.08f;
                        EndClimb(); body.position=new Vector2(exitX,exitY); body.linearVelocity=Vector2.zero;
                        lastGrounded=Time.time; LandedAt=Time.time;
                    }
                    else if(pos.y<=vine.bottom+.01f && vertical<0)
                    { EndClimb(); body.position=new Vector2(pos.x,vine.bottom+.08f); }
                }
            }
            else
            {
                float speed=Time.time<attackUntil?3.1f:6.4f;
                if(Time.time>=knockbackUntil)
                {
                    float target=horizontal*speed;
                    float acceleration=Grounded?65:36;
                    body.linearVelocity=new Vector2(Mathf.MoveTowards(body.linearVelocity.x,target,acceleration*Time.fixedDeltaTime),body.linearVelocity.y);
                }
                if(jumpBuffered>=Time.time && Time.time-lastGrounded<.13f)
                {
                    body.linearVelocity=new Vector2(body.linearVelocity.x,11.8f); jumpBuffered=0; lastGrounded=-10; Grounded=false;
                    stage.Jumps++; stage.Sound("jump");
                }
                if(!jumpHeld && body.linearVelocity.y>5) body.linearVelocity=new Vector2(body.linearVelocity.x,Mathf.Max(5,body.linearVelocity.y-35*Time.fixedDeltaTime));
                if(body.linearVelocity.y<0) body.linearVelocity+=Vector2.down*13*Time.fixedDeltaTime;
            }
            jumpRequest=false;
            if(transform.position.y<-5.2f) stage.Fall();
            if(transform.position.x<-1.5f) body.position=new Vector2(-1.5f,body.position.y);
        }

        void BeginClimb(Vine option)
        {
            Climbing=true; vine=option; stage.Climbs++; body.linearVelocity=Vector2.zero;
            body.bodyType=RigidbodyType2D.Kinematic; capsule.isTrigger=true;
        }
        void EndClimb()
        {
            Climbing=false; body.bodyType=RigidbodyType2D.Dynamic; capsule.isTrigger=false; body.gravityScale=1;
        }
        public void TakeKnockback(float sourceX)
        {
            if(Climbing) EndClimb();
            invulnerableUntil=Time.time+1.15f; knockbackUntil=Time.time+.25f;
            body.linearVelocity=new Vector2(transform.position.x>=sourceX?5:-5,5);
        }
        public void Respawn(Vector2 position)
        {
            if(Climbing) EndClimb();
            body.position=position; body.linearVelocity=Vector2.zero; invulnerableUntil=Time.time+1.5f;
        }
        void UpdateAnimation()
        {
            float distance=Mathf.Abs(transform.position.x-lastX); walkPhase+=distance*.22f;
            climbPhase+=Mathf.Abs(transform.position.y-lastY)*.35f;
            lastX=transform.position.x; lastY=transform.position.y;
            string key; float phase;
            if(Climbing) { key="uga.climb"; phase=climbPhase; }
            else if(Time.time<attackUntil) { key="uga.attack"; phase=Time.time-(attackUntil-.42f); }
            else if(!Grounded && Mathf.Abs(body.linearVelocity.y)>.6f) { key="uga.jump"; phase=body.linearVelocity.y>2?0:body.linearVelocity.y<-3?.4f:.2f; }
            else if(Mathf.Abs(body.linearVelocity.x)>.3f) { key="uga.walk"; phase=walkPhase; }
            else { key="uga.idle"; phase=Time.time; }
            visual.sprite=stage.Art.Get(key,phase); visual.flipX=Facing<0;
            visual.color=Invulnerable && Mathf.FloorToInt(Time.time*12)%2==0?new Color(1,1,1,.45f):Color.white;
        }
    }
}

