using UnityEngine;

namespace SLU.Traversal
{
    [System.Serializable] public struct PlatformSpec { public Vector3 center, size; public PlatformSpec(Vector3 c, Vector3 s){center=c;size=s;} }
    [System.Serializable] public struct TargetSpec { public string id; public Vector3 position; public Vector3 driftAxis; public float driftAmplitude, driftSpeed; public bool shielded; public TargetSpec(string i, Vector3 p, Vector3 a=default, float amp=0, float speed=0, bool shield=false){id=i;position=p;driftAxis=a;driftAmplitude=amp;driftSpeed=speed;shielded=shield;} }
    public sealed class RoomSpec
    {
        public string id, title, lesson; public Vector3 spawn, goal; public int requiredKills; public PlatformSpec[] platforms; public TargetSpec[] targets;
        public RoomSpec(string i,string t,string l,Vector3 s,Vector3 g,int k,PlatformSpec[] p,TargetSpec[] e){id=i;title=t;lesson=l;spawn=s;goal=g;requiredKills=k;platforms=p;targets=e;}
    }

    public static class TraversalRoomCatalog
    {
        static Vector3 V(float x,float y,float z)=>new(x,y,z);
        static PlatformSpec P(float x,float y,float z,float sx,float sy,float sz)=>new(V(x,y,z),V(sx,sy,sz));
        static TargetSpec T(string id,float x,float y,float z)=>new(id,V(x,y,z));

        public static readonly RoomSpec[] ActI = {
            new("room-01","WRITE THE LINE","Kill the sphere. Hold RMB, then release to spend its vector.",V(0,2.2f,6),V(0,1.1f,-24),1,new[]{P(0,0,5,12,1,10),P(0,0,-22,12,1,10)},new[]{T("r1-sentry",0,2.2f,-19)}),
            new("room-02","STOP SHORT","The sphere is beyond the landing. Hold RMB + wheel, then release before 100%.",V(0,2.2f,6),V(0,1.1f,-16),1,new[]{P(0,0,5,10,1,10),P(0,0,-16,8,1,7)},new[]{T("r2-sentry",0,2.2f,-28)}),
            new("room-03","CHAIN","Warp high, reacquire, then fire again.",V(0,2.2f,6),V(8,1.1f,-33),2,new[]{P(0,0,5,10,1,10),P(3,2.75f,-18,18,5.5f,1),P(8,0,-31,10,1,10)},new[]{T("r3-high",0,7.5f,-11),T("r3-far",8,4.2f,-31)}),
            new("room-04","ORIGIN MATTERS","Move right before the kill so the written vector starts there.",V(-5,2.2f,6),V(7,1.1f,-28),1,new[]{P(0,0,5,18,1,11),P(7,0,-25,9,1,11)},new[]{new TargetSpec("r4-shield",V(5,2.2f,-21),default,0,0,true)}),
            new("room-05","FIND THE FASTER ROUTE","Reach the exit with at least two kills.",V(0,2.2f,8),V(0,1.1f,-43),2,new[]{P(0,0,7,14,1,12),P(-8,1.5f,-12,8,1,8),P(9,3,-25,8,1,8),P(0,0,-41,14,1,12)},new[]{T("r5-left",-8,4.2f,-12),new TargetSpec("r5-drift",V(0,7,-22),Vector3.right,7,1.15f),T("r5-right",9,5.7f,-25),new TargetSpec("r5-final",V(0,4,-36),Vector3.up,3,1.4f)}),
            new("room-06","LOW PROFILE","There is no jump. Crouch under the structure.",V(0,2.2f,8),V(0,1.1f,-20),1,new[]{P(0,0,4,10,1,14),P(0,2.3f,-1,6,.8f,4),P(-3.35f,1.4f,-1,.7f,2.8f,4),P(3.35f,1.4f,-1,.7f,2.8f,4),P(0,0,-18,10,1,9)},new[]{T("r6-low",0,2.2f,-18)}),
            new("room-07","MOVING ENDPOINT","Time the kill when its coordinate passes over the landing zone.",V(0,2.2f,7),V(8,1.1f,-20),1,new[]{P(0,0,6,10,1,10),P(8,0,-20,5,1,8)},new[]{new TargetSpec("r7-drift",V(0,2.2f,-20),Vector3.right,12,.82f)}),
            new("room-08","REORIENT","Reach the side perch, then use the new line of sight.",V(-6,2.2f,6),V(8,1.1f,-30),2,new[]{P(-6,0,5,10,1,10),P(0,3,-12,14,6,1),P(8,2,-8,5,1,5),P(8,0,-30,10,1,10)},new[]{T("r8-perch",8,4.2f,-8),T("r8-behind",8,4.2f,-30)})
        };
    }
}
