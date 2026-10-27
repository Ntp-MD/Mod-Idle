# Part 1 — Skill direction, animation and impact coherence

วันที่: 2026-10-27

สถานะ: **แผน implement รอบใหม่ — ยังไม่ได้เปลี่ยน runtime หรือรัน acceptance ในงานเอกสารนี้**

เอกสารคู่กัน: [Part 2 — VFX improvement and production](skill-vfx-coherence-plan.md)

## 1. ผลลัพธ์และขอบเขต

ให้ทุก action มีความต่อเนื่องตั้งแต่ **เลือกสกิล/เป้า/จุดยืน → เล็ง → เตรียม → commit → ปล่อย → กระทบ → คืนท่า/คงผล → จบอายุ**. Actor, อาวุธ, range preview, telegraph, VFX, HP/status และ feedback ต้องอธิบาย action เดียวกัน

**รวมการปรับปรุง VFX จริง:** Part 1 เตรียม/ปรับ gameplay-to-presentation contract และ animation binding; Part 2 แก้ anchors, direction, scale, choreography, composition, contact effects และรับ/ผลิต asset ที่ยังขาด พร้อมตรวจในสนามจริง

- ต่อยอด current implementation; แผน combat/VFX รอบก่อนปิดงานและถูกลบแล้ว ไม่มี dependency ให้ย้อนทำ milestone เก่า
- ต่อยอด automatic rotation/manual commands, modular hex travel, current formulas และ existing event scheduler. การเปลี่ยนrange/timing/field/procที่เลือกในแผนนี้ต้องเป็นexplicitcanonicalmigrationพร้อมcompatibilityevidence;ไม่เปลี่ยนจำนวนเพียงเพื่อกลบภาพผิด
- การเปลี่ยน instant cone เป็น swept attack, ground burst เป็น expanding damage wave หรือ DoT เป็น field คือ gameplay change ที่ต้องระบุ packet/data/compatibility ชัดเจน
- ใช้ current working art ระหว่างพิสูจน์ core. New-art acceptance แยกเป็น joint gate เมื่อ candidate พร้อม
- Mob basics และ mob skills ใช้ contract เดียวกับผู้เล่น โดยอ่าน kit/profile จริง
- รายละเอียดการสร้างภาพและ ownership ของผู้ผลิตอยู่ Part 2; ไม่เริ่ม batch ซ้ำกับ agent ผู้ผลิตที่กำลังทำ

### 1.1 Closed product direction — RO + PoE สำหรับ auto combat

ออกแบบรอบนี้ให้ผู้เล่นจัดbuild/rotationแล้วตัวละครเลือกเป้าและเข้าระยะอย่างมั่นคง พร้อมmanualfocus/move/castแทรกได้ตามcommitment. ความหนาแน่นของสกิลและbuild interactionsต้องอ่านออกผ่านreal hits/statuses/fields;ภาพต้องแสดงเวลา ระยะ ทิศ และระดับความสูงอย่างต่อเนื่อง

ข้อเลือกในsections3.4–3.6/5.4–5.7/6.3–6.4เป็น**release designที่เลือกแล้ว**ร่วมกับdirection/landing/piercing/rhythm rulesเดิม. สิ่งที่ระบุว่าเป็นmigrationคือimplementationที่ต้องทำพร้อมdata/readers/save/verification ไม่ใช่คำถามให้implementerเลือกmechanicใหม่เอง

Definition of completeness: currentlive92rowsและactualmobprofilesต้องresolveเป็นexecution specที่ไม่มีunknownshape/clock/anchor/height/contact/lifetime. Workinglegacyfallbackใช้ระหว่างเปลี่ยนได้ แต่fallbackที่ยังไม่ผ่านสเปกของrowไม่ถูกนับเป็นfullvisualcompletion

## 2. Sources ที่ตรวจแล้วและขอบเขตหลักฐาน

อ่าน source แบบ read-only วันที่ข้างต้น. ไม่มีการรัน gameplay tests, asset checker หรือ browser ระหว่างเขียนแผน

| เรื่อง | Source ปัจจุบัน / symbols |
| --- | --- |
| Canonical skills | [skills.json](../../tools/data/skills.json): `cast`, `area`, `action`, `effects`, rules และ effect text |
| Stats/body/basic profiles | [engine.json](../../tools/data/engine.json); [spawns.json](../../tools/data/spawns.json) สำหรับ field policies |
| Weapons/offhand | [bases.json](../../tools/data/bases.json) |
| Shapes/timing schema | [engine/types.ts](../../engine/types.ts): `SkillAreaSnapshot`, `SkillCastProfile`, `SkillCastTiming` |
| Shape builder/query | [skill-area.ts](../../engine/skill-area.ts): `skillAreaSnapshot`; [skill-actions.ts](../../engine/skill-actions.ts): `targetsInSkillArea`, `firstProjectileHit` |
| Intent/aim/flight | [combat-actions.ts](../../game/src/sim/combat/combat-actions.ts): `CombatIntent`, `CombatFlight`, `trackIntentAim`, `flightTargets` |
| Executable actions/impacts | [game.ts](../../game/src/sim/core/game.ts): `releaseIntent`, `resolveFlight`, cancel/basic/mob paths |
| Clock/order | [combat-clock.ts](../../game/src/sim/combat/combat-clock.ts): comparator และ event priorities |
| Actor/payload snapshots | [combat-arena.ts](../../game/src/sim/combat/combat-arena.ts) |
| Field/save compatibility | [field-area.ts](../../game/src/sim/world/field-area.ts), [pending-work.ts](../../game/src/sim/core/pending-work.ts), [save.ts](../../game/src/state/save.ts) |
| Enemy skills | [mobSkills.ts](../../game/src/sim/combat/mobSkills.ts), [mob-skills.json](../../tools/data/mob-skills.json) |
| Camera/phase/socket | [arena-camera.ts](../../game/src/presentation/arena-camera.ts), [combat-arena-view.ts](../../game/src/ui/combat/combat-arena-view.ts) |
| Actor/equipment art | [arena-art.ts](../../game/src/ui/combat/arena/arena-art.ts), [arena-equipped-player.ts](../../game/src/ui/combat/arena/arena-equipped-player.ts), [player-equipment-v1.json](../../game/src/ui/combat/arena/player-equipment-v1.json) |
| Host/VFX handoff | [CombatArenaScene.svelte](../../game/src/ui/combat/CombatArenaScene.svelte), [arena-vfx-space.ts](../../game/src/ui/combat/arena-vfx-space.ts): `skillHandoffFor` |

Current roster snapshot: **92 live player skills — attack 56, buff 9, curse 6, heal 3, aura 18**. Re-enumerate current non-retired rows at implementation time; numbers are observations, not content quotas

สิ่งที่มีแล้วและต้อง reuse:

- Cone/line committed geometry พร้อม direction, width/angle/reach; ground-projected shape rendering
- Release/impact timing, payload samples และ corrected contact path สำหรับงานที่รองรับอยู่
- Actor phase/gait/camera helpers และ frame-level player grip/equipment support
- Authored/spatial/component VFX manifests และ legacy fallback

ช่องที่ต้องตรวจ/ปรับในรอบนี้:

- Current grips/release sockets ยังไม่ใช่ full weapon-tip trajectory ทุก frame/action/direction
- `effectView` มี generic body lift/fallback; หลาย effect families ยังเลือก source/target center จาก recipe
- Resolved target ids/terminal contact มีแล้ว แต่ต้องพิสูจน์ per-target contact point และ result ownership สำหรับ melee/cone/line
- ทิศและพื้นที่ถูกไม่ได้รับรองว่าภาพอาวุธ, active window, component orientation และ hit feedback ตรงกันครบ
- Skill name, `duration` หรือ `dot_sec` ไม่พิสูจน์ว่าเป็น deployed field; inspect execution owner โดยเฉพาะสกิลที่เพิ่มภายหลัง

## 3. Shared contract และหน่วย

### 3.1 แกนอิสระที่ต้องนิยามต่อสกิล

| แกน | ตัวอย่าง / ความหมาย |
| --- | --- |
| Shape | single, line, cone, circle |
| Origin/aim | caster, selected actor, requested ground point, committed direction |
| Delivery | melee, projectile, ground, instant ตาม canonical profile |
| Temporal model | one impact, projectile burst, pulse series, deployed field, channel, chain หรือ state change |
| Motion | swing/thrust/bash/slam/cast/spin; actor pose กับ weapon path |
| Anchors | ground origin, main/offhand grip, weapon tip/muzzle, contact, status recipient |
| Tracking/lock | สิ่งใดตามเป้าได้ ระหว่างช่วงใด และล็อกเมื่อไร |
| Lifecycle | follow/fixed, cancellation, source/target death, area transition และ expiry |

Map ลง types/readers ที่มีอยู่ก่อนเพิ่ม field. Gameplay fields อยู่ canonical data/engine/sim; visual motion/material/forward-axis อยู่ art/recipe. ไม่คัด damage, radius หรือ cooldown เข้า manifest เป็น truth อีกชุด

### 3.2 Identity/time facts

แต่ละ consumer ต้องอ่าน actor+generation, arena epoch, action, payload/launch, impact/pulse และ actual recipient จาก owner เดียวกัน. แยก candidate, committed work, predicted terminal และ resolved receipt

- Simulation ใช้ integer combat time และ comparator เดิม. Render callbacks/texture loops ไม่ให้สิทธิ์ hit/proc
- Current primary end แยกจาก projectile arrival, field expiry และ status duration
- Sample ณเวลา t แสดง facts ที่มีผลแล้ว ณ t; resolved future target/death ไม่รั่วย้อนมาขณะ playhead ยังอยู่ก่อน impact
- Contact correction invalidate เฉพาะ payload track ที่เกี่ยวข้อง; flight prefix ที่เคยแสดงไม่เปลี่ยนเพราะ normalize ตาม arrival ใหม่
- Cached animation/equipment state keyed ด้วย stable identity; ไม่ใช้ array index หรือ species name แทน spawn identity

### 3.3 Spatial units และ body baseline

- ตำแหน่ง/ระยะเป็น continuous world meters; standard ground footprint diameter 0.5m, radius 0.25m ตาม design ที่ผู้ใช้เลือก
- Body scale ที่ต่างต้องเป็น explicit canonical override. `readsAs`, rank, PNG width และอาวุธยาวไม่เลือก footprint ใหม่เอง
- ใช้ projected ground footprint ใต้เท้าเป็น ruler; art height/chibi head/weapon reach/inspect extent แยกกัน
- Cast reach, effect reach, body clearance และ decorative glow เป็นคนละค่า
- Center/edge semantics ต้องตรง query owner: AoE center membership, projectile/body sweep และ melee release/contact predicates ไม่ถูกขยายด้วยภาพ
- หาก current data ยังใช้ body radii ต่างจาก design ให้เปิด explicit geometry migration พร้อม compatibility/pressure review; การเขียนแผนไม่ใช่การเปลี่ยน runtime แล้ว

Currentdataที่สำรวจรอบนี้มีplayerและbodyclassesradius0.25mแล้ว;ให้reuseไม่migrateซ้ำ. ความเปลี่ยนใหม่คือactivecontact semantics,field/multi-impact profilesและheightpresentationที่ระบุด้านล่าง

Boundsเลือกตามentity: actorcenterอยู่radius-insetdomain;groundcastpointอยู่validgrounddomainโดยไม่ต้องให้AoEทั้งวงfitข้างใน;วงที่ล้นขอบไม่ถูกย้าย/ย่อเพื่อให้สวย. Executableprojectileจบที่authoredrangeหรือfieldboundaryตามprofileและarenaepoch;offscreenrendercullingไม่จบsimulation. Fallingdecorativecomponentอาจเริ่มนอกviewportได้เมื่อlandingpointยังvalidและไม่สร้างgameplayworkข้ามhex

### 3.4 Clock domains, speed และ commitment

| Domain | Selected owner/policy |
| --- | --- |
| World progression | Existing world tick และ credited time;ไม่เพิ่มschedulerแข่งขัน |
| Action events | Integer CombatClock และ comparatorเดิม;resolve/receiptsก่อนpresentation |
| Playback speed | เปลี่ยนอัตราเดินของplayhead/creditedsimulationตามhost;ไม่คูณซ้ำในactor/particle/arc |
| Basic attack cadence | Existing effective weapon rate/progress ledger;windup+recoveryอยู่ภายในintervalเดียว |
| Attack-skill timing | Target designใช้normalizedeffectiveattack-speed factorจากengineสำหรับweapon-boundattackprofiles;global/slowถูกรวมครั้งเดียว |
| Spell/support timing | ใช้currentglobal-action/cast factorจากengine;ไม่เพิ่มcast-speed statใหม่จากartwork |
| Projectile travel | Worlddistanceและauthoredprojectile speed;ASPDไม่เพิ่มmissile speedเอง |
| Ground delay/field/pulses | Explicit action schedule;ไม่เร็วขึ้นตามtextureFPSหรือASPDเว้นแต่data author policyนั้น |

SC-Tต้องทำspeed-resolution migrationอย่างexplicit: physicalweapon-boundskillsresolveattacktimingprofile;spell/supportresolvecastprofile;fixedchannel/burstintervalอ่านpolicyของactionนั้น. Currentactivecastsใช้`c.globalSpeed`อยู่แล้ว จึงต้องเปรียบเทียบlegacy/newphasebudgetsและอัปเดตengine/data/type/readersพร้อมกัน ไม่เปลี่ยนเฉพาะanimation. ExposeeffectivefactorจากownerformulaแทนคัดASPDcalculationเข้าUI

Selectednormalization: canonicaltimingprofileมีreferenceattackrateเริ่มต้น1attack/s. `S_attack = effectiveActiveWeaponRateHz / referenceAttackRateHz` โดยeffectiveActiveWeaponRateรวมASPD/weapon/berserk/chill/global-actionfactorจากownerอย่างละหนึ่งครั้ง. ไม่นับpause/playbackหรือ`playerActiveFraction`ที่เป็นสัดส่วนเวลาถูกcontrolในworldtickเป็นspeedstat. `S_cast`ใช้currentglobal-actionfactorและcastmodifiersที่มีจริง;`S_fixed=1`. Preparation/recovery base secondsหารด้วยfactorของprofileครั้งเดียว

SC-Tต้องแสดงfactorprovenanceและmeaningfultestsว่าweapon-speedเพิ่มแล้วattack-skillphaseเร็วขึ้น,castprofileไม่รับASPDโดยเดา,global/slowไม่ถูกคูณสองรอบ และsameactualfactorให้timelineเดียวกันทั้งengine/Scene. ไม่มีnewcast-speedcurrency/statที่ไม่ได้อยู่ในdata และไม่เอาค่าreference1Hzไปแก้basicdamage/attackprogressformula

Row assignmentที่เลือก: currentmelee/rangedmotionattacksใช้explicitattacktimingmode,magicattacksและbuff/curse/healใช้castmode,auraenable/stateใช้state/fixedmode. VenomSprayเป็นcastmodeแม้deliverytagmelee. Nonblockingtriggerใช้triggerownerที่มีpreparation/recoveryoverride ไม่ยึดprimaryหรือสร้างcastbarเต็มขึ้นมาใหม่. Compileprofileให้explicitในcanonical/readers ไม่ใช้damageElementหรือassetframeMsเป็นตัวตัดสินspeedmode

Selected commitment:

- Timedskillphase durationsล็อกเมื่อpreparationเริ่มตามresolvedfactor;normalbuff/slowchangeมีผลต่อactionถัดไป เว้นแต่currentownerออกexplicitretime/controlreceipt
- Releaseยังrecomputeallowedsource/aim/travelจากfactsปัจจุบัน;payment/cooldowncommitที่releaseตามowner
- Hardcontrol/death/manualcancellationทำงานที่eventboundaryจริง. Displayไม่รอatlasจบเพื่อปล่อยprimaryownership
- Whirlwindactive1.2s/3pulsesยังเป็นfixedactionwindowตามdata. Speedmigrationไม่เพิ่มpulsecountหรือdamagebudget
- Burstinterval,fielddurationและDoTalignmentมีauthoringpolicyของตัวเอง;ไม่มีdefaultว่า“ทุกอย่างหารด้วยattack speed”

### 3.5 Selected 2.5D world/height model

เลือก**grounded2.5D combat**สำหรับreleaseนี้. Gameplayposition/area/contactradiusอยู่บน(x,y)พื้น;presentationมีheight`h`เป็นเมตรอย่างเป็นระบบ. Grounded/hoveringartยังใช้declaredgroundtargetability;hจากภาพไม่สร้างairborneimmunityหรือheight-basedmissโดยอัตโนมัติ

```text
ground position = (xM, yM)
presentation position = (xM, yM, hM)
screen = projectGround(xM, yM) + cameraHeightVector * hM
cameraHeightVector = (0, -heightPixelsPerMeter)
```

- เพิ่มheightprojectionที่camera ownerเดียวกับpoint/vector/inverse. Calibrate`heightPixelsPerMeter`ครั้งเดียวจากneutralstandardplayerbodyที่declaredreferenceheight1.0mภายใต้currentfootprintscale;ไม่deriveจากcurrentattackcellหรือmeteortextureheightทุกframe
- Species/artprofileระบุvisualbodyheight/neutralreferenceแยกจากgroundradius0.25m. Head/cape/wings/weaponextentไม่เปลี่ยนcollisionหรือheightscaleของทั้งฉาก
- Groundaimunprojectionใช้h=0. Actorpickingใช้identityจากvisiblebodyแล้วresolvegroundcenter/declaredcontactattachment ไม่unprojectจุดมือ/หัวเป็นgroundsourceโดยเดา
- Hand/weapon/bodyattachmentsใช้measuredcelltracksหรือexplicitworldoffset+heightmetadataพร้อมprovenance. Coordinateconversionapplysourcecrop/anchor/mirror/bodyScale/cameraครั้งเดียว
- Groundfootprint/telegraph/shadowอยู่h=0. Elevatedspriteมีgroundpointและheightคนละค่า;depthsortingใช้groundpoint/roleไม่เอาelevatedscreenYไปจัดลำดับทุกชิ้นอย่างเดียว
- Currentcollision2Dยังเป็นownerของeligibility. Visualheightต้องสื่อcontactบนตัวผู้รับได้;grossattachment/pathresidualเป็นasset/calibrationfailure ไม่เพิ่มhitvolumeเพื่อกลบ
- Truejump/air-only/height-bandcollisionเป็นexplicitfuturegameplayprofileที่ต้องมีauthoritativehและqueriesก่อนenable. Currentrosterไม่ถูกจัดเป็นheight-awareเพราะภาพลอยขึ้นเฉย ๆ

### 3.6 Normative delivery/height profiles

Logicalprofileต้องแยก `groundPath`, `elevationPath`, `contactAttachment` และ `impactShape`;reusecurrentpayloadsก่อนเพิ่มstructure. `u`ด้านล่างมาจากactualrelease/terminaltimeที่coreให้

| Profile | XY / height / contact ที่เลือก |
| --- | --- |
| Direct body projectile | XYตามcommittednon-homingpath;hเชื่อมreleaseattachmentไปdeclaredaim-bodyheight;tiprotationใช้projectedfulltangent |
| Ballistic body/ground projectile | XYตามcommittedpath;`h(u)=lerp(h0,h1,u)+4*arcHeight*u*(1-u)`;collision/groundimpactตามdeliveryจริง |
| Sky drop | LandingXYคงที่ มีdeclaredside-driftได้;`h(u)=dropHeight*(1-u*u)`เพื่อเร่งตกและจบh=0ที่deadline |
| Vertical strike | XYคงที่ที่resolvedtarget/groundpoint;column/boltจากdeclaredheightลงมาในcuewindow ไม่เพิ่มtravelhitที่ไม่มีในdata |
| Rising ground effect | BaseXY/h=0คงที่;reveal/extendส่วนยอดขึ้น ไม่ย้ายทั้งภาพจนฐานลอย |
| Ground envelope/wave | Shapeอยู่h=0;visualcrest/residueมีheightได้แต่ไม่เปลี่ยนone-press→travellingdamage |
| Weapon/body attachment | Samplerตามcurrentpose/committedaction;ไม่มีphysicalrayใหม่จากtrailmesh |
| Field weather/aura | Fixed/caster/recipientbindingตามlifecycle;ambientheightไม่เลือกtargetsหรือproc |

Interpolation/elevationcorrectionต้องcausal: releasepath/bridgecurvefreezeตามeffectivefacts. Interceptionใช้actualcontactrecipientและboundedterminalattachmentที่เข้ากับbodyprofile;ไม่rewriteflightprefixหรือย้ายburstไปoldtarget. Bodyaimheight/arcที่ทำให้เกิดgrossmiss-lookingimpactต้องแก้metadata/profileก่อนpromote

### 3.7 Execution-spec normalization และsemantic precedence

เลือกpurecompiledhandoffจากcanonicalrow→resolvedexecution specที่actor/AI/VFX/copyอ่านร่วมกัน. เริ่มจากcurrent`skillHandoffFor`/enginefactoriesแล้วขยายให้ครอบsemanticsจริง ไม่สร้างruntimeimportจากdocsหรือIDif-elseคนละชุดในrenderer

Precedenceที่เลือก:

1. State types (`aura/buff/curse/heal`) resolve recipient/state lifetimeก่อนอนุมานattackshape
2. Explicitactionkind resolve burst/channel/field/chain/impact-splashและhit schedule
3. Delivery resolve path/contact/arrival;shape resolveactualimpactextentตามactionkind
4. Explicitmotion/height/equipmentrequirement resolve presentationและeligibilityตามowner
5. Legacyadapterใช้เฉพาะknownoldrecord;newunknown/malformedprofileเป็นdiagnostic/gatefailure ไม่defaultเป็นtarget-centeredstamp

| กรณีที่ต้องปิด | Resolved meaning |
| --- | --- |
| Chain Lightning `area.radius_m=3` | Secondaryhopreachตามchainprofile ไม่ใช่วงAoEdamage3mรอบprimary |
| Split Shot circle | Impactshapeหลังactualcollision แยกจากmissilepath. Predictedaimpointไม่เป็นguaranteedlandingcircle |
| Caster nova | Casterfoot-originimpactarea;ไม่จำเป็นต้องมีfixedremoteaimpointหรือprojectile |
| Status-duration attack เช่น Reap/Frostbite | Initialattackphase + independentrecipient/selfstate;durationไม่ยืดslash/flight |
| Multiple hits/action null | WaterBall/DoubleStrikeต้องรับexplicitmigrationsในSC-X;publishไม่ได้ด้วยgenericrepeat fallback |
| Actor scale / hover art | Groundbodyradiusกับvisualbodyheight/hoverattachmentเป็นคนละmeaning ไม่เพิ่มimmunityหรือreachจากart |

Targetselectorsต้องแยกprimaryacquisition,damagearea,secondaryspread/hop,presencerecipientsและofflinequeueapproximation. `targets` textไม่ใช่จำนวนparticlesหรือimplicitonlineAoEcap. Basic/mob/triggeractionsใช้normalizedcontractแบบเดียวกันพร้อมprofile-specificeligibility ไม่ยืมplayerrowที่ชื่อคล้ายมาเดา

Inputdecisionsแยกactor-pickกับgroundaim: single-target/bodyclickresolveactorIDแล้วใช้groundcenter/declaredattachment;groundplacementคงpointที่ผู้เล่นเลือก;direction-targetใช้ray. Previewต้องแสดงresolvedaimก่อนconfirmเพื่อไม่ให้การคลิกหัวspriteทำgroundrayคลาดโดยไม่รู้ตัว

## 4. Direction, cone และ projection

### 4.1 สี่ทิศที่อาจต่างกัน

Movement heading, body facing, requested aim และ committed attack direction แยก semantic. Body ใช้ clip direction ที่มี ส่วน hit geometry/VFX ใช้ actual world direction ที่ action ยืนยัน

Selected rule: permitted preparation ติดตาม target เดิมได้; release ล็อก aim/shape สำหรับ fixed actions; released projectile/line/cone ไม่หันตาม nearest actor ใหม่. Profile ที่ล็อกก่อน release ต้องประกาศ lock time และแสดง cue ให้ตรง

### 4.2 Cone axis กับ sweep chronology

Cone มี apex, center direction θ, reach R และ **full opening α ≤180°**. ขอบคือ θ−α/2 ถึง θ+α/2. Weapon sweep มี start/end angle และ progress อีกชุด; ห้ามใช้ facing flip แทน sweep progress

- Initial compatibility: Cleave/Venom Spray ใช้ impact schedule ของ runtime ปัจจุบัน. ภาพกวาด/พ่นประกอบหนึ่ง impact ได้ แต่ไม่ให้เกิด damage/proc ใหม่ตาม texture frames
- Swept blade/fan ที่ตรวจโดนต่อเนื่องเป็น optional explicit gameplay extension: author active window/contact policy/share/once-per-target และ update readers/save/tests พร้อมกันก่อนใช้
- Actor ที่อยู่หลังผู้ร่ายและนอก cone ไม่มี successful-hit cue. Actor ที่อยู่ในวง bounding circle แต่นอก cone ก็ไม่โดน
- Aim ตรงกับ caster ใช้ declared facing fallback; ไม่สุ่มมุมหรือ reuse direction ของ action อื่น

### 4.3 Transform ที่ใช้ร่วมกัน

1. สร้าง shape/trajectory ใน world coordinates
2. ใช้ `projectArenaPoint`/`projectArenaVector` และ inverse จาก camera owner เดียว
3. Ground sector/line project vertices จริง; ไม่หมุน screen-space fan แล้วถือว่าครอบ world shape
4. Upright weapon/flame/meteor ใช้ camera-facing/elevation policy ของ component แยกจาก ground decal
5. Asset ระบุ local forward axis/pivot; world attack direction แปลงเป็น screen direction ก่อน orient ภาพ
6. Pointer client → view coordinates → world aim; apply camera/stage offsets ครั้งเดียว
7. Art mirroring ต้องระบุว่า mirror-safe และไม่สลับ anatomical main/offhand โดยเงียบ ๆ

### 4.4 Selected angle/rhythm handoff ให้ Part 2

Source of truth ของ visual decisions คือ **Part 2 sections 3.4–3.5 และ 5.2–5.6**: world attack axis เป็น continuous angle ไม่ snap ตาม sprite sectors; actual cone opening/line width มาจาก canonical geometry; fixed actions ล็อกที่ release; body fallback ไม่เปลี่ยน VFX/hit direction

SC1/SC2 ต้องส่ง committed axis/pivot/shape และ effective lock time ให้ consumer โดยไม่ให้ VFX คำนวณ direction จาก current target ใหม่. Initial orientation calibration ตรวจ 16directions รวม sector boundaries และ±π; exact logical geometry แยกจาก qualitytolerance ของ sourceart

SC4/SC6 ต้องส่ง actual launches/impacts/pulses/contacts ที่มี identity และ timestamp แยกกัน. VFXrecipe ใช้ nominalcue/particle rates ที่ Part2 เลือกแล้วโดยไม่สร้าง gameplayhits เพิ่ม. Genericrepeatdelay หรือ hit-count-basedloop ที่ซ้อนกับ actualevents ต้องถูกถอดจากเส้นทางนั้น

การเปลี่ยน hit cadence,one press→sweep หรือ field,budget ต่อ pulse และ proc entitlement เป็น explicitgameplaymutation ใน core; การปรับ ambientbirthrate,materialloop,trailfade และ cameraemphasis เป็น presentationmutation ที่ไม่เปลี่ยน scheduler. ต้องรายงานผลสองชนิดนี้ตาม owner ให้ถูก

### 4.5 Cast time และ landing deadline — งานเพิ่มที่ต้อง implement

ผู้ใช้ต้องการเห็นวงพื้นที่ก่อนสกิลลง พร้อม progress ที่เต็มตอนถึงเวลา. เพิ่ม **cast/landing timeline handoff** และ **landing telegraph** เป็น deliverable ของรอบนี้ ไม่ถือว่า generic charging art ที่มีอยู่ทำงานครบแล้ว

แยกเวลาให้ชัด:

| เวลา | ความหมาย | ตัวแสดงผล |
| --- | --- | --- |
| Cast preparation | `startedAtUs → releaseAtUs`; actor ยังเตรียม/ร่าย | Actor cast progress และสถานะกำลังร่าย |
| Landing countdown | Start ของ telegraph → first actual scheduled landing/impact | Ground shape + progress/remaining time |
| Post-release delay/travel | `releaseAtUs → landingAtUs` | ตัวร่ายอาจคืนท่าได้แล้ว ขณะที่วงยังรอการลง |
| Active field/channel | Deployment/first pulse → actual end | Active footprint และ pulse cues; ไม่เริ่ม cast bar ใหม่ทุก pulse |

Selected policy:

- เริ่มวงนับเวลาเมื่อ actual preparation เริ่มและมี scheduled landing ที่ valid. ระหว่างเดินเข้าระยะมี placement preview ได้แต่ยังไม่แสดง countdown ปลอม
- ก่อน release, point/direction ตามได้เฉพาะช่วงที่ tracking policy อนุญาต. Release freeze fixed-ground landing center/shape; ring ไม่ตามศัตรูที่เดินออกไปหลังจากนั้น
- `landingAtUs` อ่าน actual ground arrival/impact;สำหรับtruefieldหมายถึง**fieldactivation**. `firstDamageAtUs`/subsequentpulsesแยกจากdeploymentและlanding. ไม่สัญญาว่าfieldที่ไม่มีinitialdamageจะลงHPทันทีเมื่อวงactivationเต็ม
- ระหว่าง windup ที่ payload schedule ยังไม่ถูกสร้าง ให้ core ส่ง predicted first landing จาก timing/schedule resolver เดียวกับที่จะ commit ตอน release. แยก helper บริสุทธิ์จาก current scheduling branch เมื่อจำเป็น แล้วให้ preview/scheduler ใช้ร่วมกัน; ไม่คัดสูตร field/burst ไปให้ UI เดาเอง และไม่ roll RNG/spend เพื่อทำ preview
- เมื่อ release ยืนยัน schedule แล้ว สลับ predicted deadline ไป committed deadline ของ action เดิม พร้อม effective revision;วงต่อเนื่องและ remaining อัปเดตตามข้อเท็จจริง ไม่เริ่ม cast ใหม่
- ภาพเต็ม progress ตอน `landingAtUs`; actual damage/status ยังเกิดจาก CombatClock. ไม่มี callback ของวงลง damage/ปล่อยสกิล
- Self-following channel ใช้ footprint ตาม sampled caster ไม่อ้างเป็น fixed landing point. Ordinary arrow/single melee ไม่สร้าง ground AoE countdown ที่กล่าวอ้าง splash ใหม่
- Player ground AoE แสดงวงทุก cast ที่ valid รวม auto/manual/empty ground. Enemy ground AoE/explicit heavy threat แสดงตาม actual public geometry. ใช้ quiet/priority policy แยกจาก ordinary basic swings

Cast-time implementation ใช้ `meta.action_profiles` + per-row `cast` overrides ของ `skills.json` และ current engine timing resolver เป็น source เดียว. Ground profile ปัจจุบันมี windup 0.4s/impact delay 0.45s ที่ 1× action speed; first pass ใช้ resolved timing ที่มี ไม่เพิ่ม invisible delay เพื่อให้วงดูนาน. สกิลที่ต้อง author cast time ต่างต้องเพิ่มที่ canonical row และตรวจ cooldown/resource/interrupt/cadence compatibility พร้อมกัน ไม่ตั้งเวลาใน component

Logical handoff ที่ SC2-L ต้อง resolve จาก current records:

```text
telegraph identity = arena epoch + action id + landing/pulse group
caster / skill / relation / preparation or committed phase
startedAtUs / releaseAtUs / landingAtUs
deadlineKind: predicted-before-release | committed
deployedAtUs? / firstDamageAtUs? / nextPulseAtUs? / expiresAtUs?
current permitted preview geometry / committed geometry
tracking or fixed or caster-following policy
cancelledAtUs? / cancellation reason / effective revision time
```

Map ลง action/payload/field records ที่มี; ไม่เพิ่ม saveable UI timer/store อีกชุด. Landing promise ของ pending paid work ต้อง survive reload ตาม pending-work owner; transient arc/DOM state reconstruct จาก current facts

Progress/remaining values ใช้ combat playhead เดียวกับ actors/VFX:

```text
castProgress = clamp((t - startedAtUs) / (releaseAtUs - startedAtUs), 0, 1)
landingProgress = clamp((t - telegraphStartUs) / (landingAtUs - telegraphStartUs), 0, 1)
landingRemainingSec = max(0, landingAtUs - t) / unitsPerSec
```

Zero-duration phase จบตรง boundary โดยไม่หารศูนย์; instant impact แสดง impact cue ปกติ ไม่เพิ่ม cast delay. ใช้ as-of facts เมื่อ Scene lagged/seek; terminal/cancel ที่รู้จาก simulation อนาคตไม่ทำวงหายก่อนเวลาใน playhead

Deadline ที่แก้จริงให้ update remaining/deadline และ effective revision ของวงร่วม payload. ถ้าต้องรักษาความต่อเนื่องของ arc ให้ rebase จาก current progress ณ revision ไปหา new deadline โดยไม่ย้อนแก้ sample ก่อน revision และไม่ค้าง 100% รอ impact ที่ยังไม่ถึง

Cancel unpaid preparation จบวงพร้อม action; released work ที่ยัง valid เก็บวงถึง actual terminal. Arena exit/replacement/actual cancellation จบวงตาม reason. Ring ไม่มีสิทธิ์ refund, reset cooldown, reroll target หรือ cancel executable work ด้วยตัวเอง

### 4.6 Reference-backed directional patterns — หลักฐานและขอบเขต

ผู้ใช้ต้องการวิธีที่มีการใช้จริงเป็นฐาน. แหล่งด้านล่างเป็น primary developer/game documentation ที่ตรวจผ่านเว็บวันที่ 2026-10-27. มันสนับสนุนรูปแบบการออกแบบ/เทคนิคที่ใช้จริง ไม่ได้เปิดเผย internal implementation ทั้งหมดหรือพิสูจน์ว่า parameter เดียวดีที่สุดสำหรับทุกเกม

| Evidence | สิ่งที่ source ยืนยัน | สิ่งที่เลือกนำมาใช้ |
| --- | --- | --- |
| [Riot — Clarity in League](https://www.leagueoflegends.com/en-us/news/dev/clarity-in-league/) | Hitbox/effect alignment, directional readability และ visual hierarchy เป็น production concerns; indicator อาจสื่อว่าหลบได้มากกว่าความเป็นจริง | Shape ต้องอ่านตรง hit policy และ warning time ต้องตรงเวลาที่มีจริง |
| [Riot — Patch 10.3, Annie VFX](https://www.leagueoflegends.com/en-us/news/game-updates/patch-10-3-notes/) | ปรับ Incinerate cone, hit effect และ quick-cast indicator ให้สอดคล้อง hitbox | Cone area, aim indicator และ contact effect ตรวจเป็นชุดเดียวกัน |
| [Square Enix — FFXIV Samurai job guide](https://na.finalfantasyxiv.com/jobguide/samurai/) | มี front-cone weaponskills เช่น Fuga และ cast-time cone เช่น Ogi Namikiri | รูป cone มีได้ทั้ง instant/cast-time และผูก motion+commit/impact ตาม action ไม่สรุปว่าทุก cone เป็น projectilefan |
| [Square Enix — FFXIV Dragoon job guide](https://na.finalfantasyxiv.com/jobguide/dragoon/) | Doom Spike/Sonic Thrust และ skills อื่นระบุพื้นที่ straight line ด้านหน้า | แยก line-area weaponskill จาก missile ที่ต้องเดินทาง และทำ forwardreach อ่านออกจากท่ากับ effect |
| [Riot — Lux / Final Spark](https://www.leagueoflegends.com/en-us/champions/lux/) | Beam หลัง preparation สร้างผลในพื้นที่ที่ระบุ | แยก delayed line-impact/beam จาก travelling missile |
| [Riot — Ashe / Enchanted Crystal Arrow](https://www.leagueoflegends.com/en-us/champions/ashe/) | Straight travelling projectile มี collision outcome | แยก travel/contact/eligibility policy จากเพียงรูป line; ไม่คัด champion-only collision ของเกมอื่นมาเอง |
| [Riot — Patch 25.23, Bullet Time](https://www.leagueoflegends.com/en-ph/news/game-updates/patch-25-23-notes/) | การปรับ damage per wave ยืนยัน wave เป็นหน่วยกลไกที่แยกได้ | Channel/wave ใช้ real wave schedule; source นี้ไม่ใช้พิสูจน์มุมหรือ collision code ของเกมนั้น |
| [Unity — SphereCast](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Physics.SphereCast.html), [CapsuleCast](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Physics.CapsuleCast.html) | Engine APIs รองรับ swept volume ที่มีความหนา และมีข้อจำกัดกรณีเริ่มทับ collider | ใช้หลัก continuous volume query กับ moving projectile; ตรวจ birth overlap แยกอย่างตั้งใจ |

**Adaptation ที่เราตัดสินสำหรับ ModWorld** อยู่ sections4.7–4.10. รูปทรง สูตร 2D ตัวเลขมุม และ proc/range policies ของเราอ้าง canonical data และ current engine; ไม่กล่าวอ้างว่าเป็น source code ของ Riot/Unity. ไม่คัด asset/code/ตัวเลขบาลานซ์เกมอื่นเข้าโปรเจกต์

### 4.7 เลือก execution archetype ก่อนเลือกภาพ

| Archetype ที่เลือก | Geometry/time semantics | Mapping ในรอบนี้ |
| --- | --- | --- |
| Sector impact | Finite sector ที่ caster origin; evaluate หนึ่งครั้งที่ impact; center-in-sector ตาม existingAoEcontract | Cleave120° และ Venom Spray90°. Spray เป็น short area burst ไม่เป็น physicalfan ของกระสุนเพียงเพราะวาดหลายเส้น |
| Line impact | Finite flat-ended rectangle; evaluate หนึ่งครั้งที่ actualimpact; center-in-strip ตาม existingareaquery | Impale และ Fissure. Fissure มี cast/landingdelay แต่ไม่ได้ทำ damage ไล่ตาม crackfront โดยอัตโนมัติ |
| Travelling line projectile | Finite moving disk/head + swept contacts; piercing/filter/terminal policy ชัด | Piercing Shot. มี path จริงและ contact แต่ละ target ตาม front ที่ถึง |
| Projectile fan | หลาย physical projectiles ที่มี individual directions/contacts ไม่ใช่ solidconearea | ยังไม่เปลี่ยนสกิลปัจจุบันเป็น fan แบบนี้. เพิ่มเฉพาะ explicitnewprofile ที่ author แล้ว |
| Channeled sector/wave | Real per-wave/pulse schedule, movement/turn policy และ per-wave entitlements | เป็น supportedmodel สำหรับ futureexplicitprofile ไม่ย้าย Venom Spray มาใช้เงียบ ๆ |

การมีรูป cone ไม่ตอบว่ากระสุนแต่ละลูกชนอะไรหรือมีช่องว่างให้หลบ. การมีรูป line ไม่ตอบว่าผลเกิดทันทีทั้งเส้นหรือเดินทาง. Inventory ต้อง resolve archetype ต่อ row; renderer ไม่มีสิทธิ์เดาจากชื่อ/สี/จำนวน particles

### 4.8 Direction-target input และ commitment ที่เลือก

- Manual cone/caster-line ใช้ **direction-target**: cursor บอกแนว และสกิลใช้ full authoredreach. Cursor ไกลกว่าปลายสกิลไม่ใช่เหตุให้เดินไปยัง cursor เหมือน ground-pointcast
- Ground-point AoE ยังใช้ตำแหน่งที่ขอและ cast range ของมัน; out-of-range movement policy แยกจาก direction-only request
- Preview แกน continuousθตรงกับแกนที่จะ confirm. Source geometry ยึด groundorigin; hand/weaponemitter เป็น visualattachment ที่ไม่เลื่อน hitsector ตาม pixeloffset
- เมื่อ pointer อยู่ใกล้ caster จนทิศไม่เสถียร ใช้ initialaimdeadzone0.125m สำหรับ standardbody0.5m แล้วคง lastvalidaim/currentdeclaredfacing. ค่าเป็น input presentation policy ไม่ใช่ hit-radius tolerance
- Attack pose เลือกตาม action aim/commitment ไม่อ่าน walkheading ที่อาจหันอีกด้าน. ไม่เพิ่ม turn-delay/cooldown ใหม่เพื่อกลบ missingdirectionalart
- ก่อน releasetrack ได้เฉพาะ target เดิมตาม profile;เมื่อ releasefixedsector/line ล็อก axis และ origin. Bodyturn หลังจากนั้นไม่ rotatecommittedshape
- Auto aim ยังเคารพ slotorder/focus/stickiness. การช่วยเล็งไม่เพิ่ม range,เปลี่ยน pointerdirection หลัง confirm หรือเลือก future victim จาก RNG

### 4.9 Geometry และ contact query ที่ implement อย่างมีขอบเขต

สำหรับ sector/line-impact ใช้ localbasis ร่วมกับ enginequery เดิม:

```text
f = (cos(theta), sin(theta)); n = (-f.y, f.x)
v = targetCenter - origin
forward = dot(v, f); lateral = dot(v, n); d = length(v)

sector: d <= reach AND dot(v/d, f) >= cos(fullOpening/2)
        d == 0 uses the engine's declared apex case
line-impact: 0 <= forward <= length AND abs(lateral) <= fullWidth/2
```

- ช่วงมุมไม่เกิน 180°;targets หลัง caster ที่อยู่นอก sector ไม่มี successfulhit จากการขยาย boundingcircle
- Sector/line-impactfirstpass รักษา center-membership ไม่บวก bodyradius เพียงเพราะเกมอื่นมี edge-overlap. ถ้าจะเปลี่ยนต้องเป็น explicitdata/querymigration
- Travelling projectile ใช้ continuous relative-motion sweep กับ actualtargetbodyradius;ไม่ใช้ ray ความหนาศูนย์หรือดูเฉพาะตำแหน่งปลาย step
- Piercing Shot เลือก **full width จาก canonicalline** เป็น authoritative width ของ projectile profile;resolve `projectileRadius = width/2` และปรับ reader/override ให้เป็น truth เดียว. ไม่ใช้ shareddefault `hit_radius_m` ที่อาจไม่เท่าครึ่ง width แล้วปล่อย indicator กับ collision คนละขนาด
- Line-projectilepreview แสดง actualswept corridor รวม endcaps ของ volume และ highlighttargets ด้วย intersectionsemantics เดียวกัน. Line-impact คง flat-endedrectangle;ไม่วาดสองแบบเหมือนกันแล้วใช้ hit policy ต่างโดยไม่สื่อ
- ประกาศ range ว่า centerpathendpoint อยู่ที่ใด และ outervolumeextent รวม radius อย่างไร. ไม่มี endpointgrab/lollipop หรือ skin-onlyreach ที่เกิน volume ที่แสดง. Cast/acquire range และ secondarybodyintersection อ่าน ownerpolicy แยกกัน
- Birth overlap ต้องมี query/candidatefilter explicit รวม source/friendly exclusions และ forward-origin eligibility;normaldirectionalprojectile ไม่เลือก center ที่อยู่หลัง origin จาก fallbackscan. Body ที่แตะ head จริงด้านหน้าอาจเป็น fraction0contact ได้
- Boundedstep/continuousquery รวม moving targets และ sortcontacttime/fraction ด้วย stable identity. Emptyinput,zero-direction,zero-radius,end-of-range และ equal-timecontacts ต้องมี definedresult

**Source-confirmed issue ที่ต้องพิสูจน์ก่อนแก้:** `sweepFlights` ปัจจุบันเรียก `firstProjectileHit`;เมื่อเป็น line จึงเรียก `resolveFlight` ซึ่งคัด targets ด้วย full line area แล้วนำ flight ออก. มีความเสี่ยงให้เป้าท้ายเส้นรับผลตอนชนตัวแรกและไม่มี travellingpierce ต่อจริง. เป็น read-onlysource finding ไม่ใช่ผลรัน test และไม่ถือว่าแก้แล้ว

Selected piercing continuation:

```text
one paid action -> one released projectile track + cast roll cache + visited-target set
each bounded motion interval -> find earliest eligible swept contact
advance/schedule contact through CombatClock -> resolve this recipient once
keep track alive -> re-query remaining interval after outcome changes
end only on range/expiry/cancel policy; never apply the whole future lane at first contact
```

Actualcontacttime ต้องเข้า existingclock ก่อน cursor ผ่านไป ไม่เขียน timestamp ย้อนหลังบน damage ที่จ่ายปลาย step แล้ว. ถ้า currentorchestration ยังทำไม่ได้ SC4-P แก้ event/motioncut ที่ owner ก่อน แทนทำ UI ให้ดูเหมือนเดินทางขณะ damage เกิดไปแล้ว

Visitedtargets/contact receipts,originalprimary/share,castcrit/target-roll cache,remaining range และ pending payload ต้อง reload/round-trip ได้ตาม pending-workcontract. Piercingcontacts ไม่จ่าย cost/cooldown/castcounter ใหม่ และไม่เปลี่ยน secondary เป็น fullprimary เมื่อ originaltarget ตาย

### 4.10 Auto aim, warning และ acceptance ที่ปิดการเดา

Geometry normalization ของ Piercing Shot เป็น **intentional gameplay-geometry change** ใน SC2-G/SC4-P: current width0.75m ให้ radius0.375m แทน shared projectile default0.35m; moving-body intersection ต่างจาก full-line center membership เดิม. ต้องบันทึกก่อน/หลัง eligible contacts, range/endcaps และ save compatibility พร้อม update canonical readers/validators ไม่เรียกว่า cosmetic-only และไม่เปลี่ยน coefficient/proc budget ชดเชยเอง. Default projectiles อื่นไม่ถูกปรับ radius ตามไปด้วย

สำหรับ travelrange ใน profile นี้ให้ `L` หมายถึง maximum projectile-center path ตาม canonical range;movinghead มี radius และ endcaps ที่ preview ต้องแสดง. Target body ที่ขอบแตะ corridor อาจรับ hit ได้แม้ center อยู่นอก lane กลาง;previewhighlight ต้องตรวจ intersection จริง. หาก ownerUI ต้องการ range เป็น leading-tip reach แทน ต้องเปลี่ยน semantics/data/queries พร้อมกันเป็นอีก explicitmigration ไม่สลับความหมายกลาง renderer

Auto cone อาจใช้ angularintervalcandidateevaluation จาก current eligible centers: bearing ของแต่ละ target ให้ช่วงแกนที่ cover มันได้;เลือกแกนที่ยัง coverfocus/primary และเพิ่ม actualcoverage ตาม approvedclusterpolicy. Tie ใช้ retaineddirection แล้ว stable identity. Implement เป็น purequery ก่อนเพิ่ม index/optimizer;manualaim ไม่ถูกเขียนทับและ post-commit ไม่ optimize ใหม่

Auto line เริ่ม candidatebearings จาก retained/primary และ eligiblecenters แล้วใช้ actualrectangle/projectilecorridorquery ประเมิน. อ่าน current positions ไม่ทำ perfectleading ด้วย futurestate. การเปลี่ยน AIopportunity ต้องวัด compatibility/throughput โดยไม่เพิ่ม damage ชดเชยเอง

Indicator ต้องสื่อ counterplay ตามเวลาที่มีจริง: delayedline/ground มี countdown ตาม deadline;instantsector ใช้ shortpreparationshape;travellingmissile แสดง lane/direction และ actualhead ไม่สัญญาว่าทั้ง lane จะโดนพร้อมกันเมื่อ progress เต็ม. ไม่เพิ่ม windup เพื่อให้ทุก marker ดูหลบง่ายโดยไม่ authorgameplay

Acceptance เฉพาะ directionalpatterns: targets ที่ near/mid/far,front/back,edge±epsilon,apex,endcaps และ largebody;missile ผ่านหลายตัวต้องได้ orderedcontacts ไม่ใช่ all-linebatch;victim ตาย/เคลื่อน/บังกันระหว่าง travel;pause/lowFPS/save กลาง pierce;cursor ใกล้ตัว/เลย range;confirm แล้วหันตัวอีกด้าน. Logicalprofile และ assetpresentation ต้องจับคู่ได้จาก inspector

Landing handoff ใน SC2-L แยกตาม archetype: line-impact มี whole-stripdeadline ได้ แต่ line-projectile ใช้ castercastprogress ก่อน release และ movinghead/contact หลัง release. ไม่เอา firstbodycollision มาเป็น deadline ที่ทำทั้ง lane เต็มพร้อมกัน;จุดชนที่ยังไม่เกิดไม่ถูกประกาศเป็น guaranteedlandingtarget

## 5. Actor motion, equipment และ melee reach

### 5.1 Motion profile กับท่าที่มีจริง

ใช้ grip/motion family ตามอาวุธ: one-hand swing, short thrust, two-hand swing, spear thrust, wand/staff cast, bow draw, crossbow release, shield bash และ spin. สกิล override motion เมื่อจำเป็น

- Inspect current clip/direction coverage ก่อนเลือก; sparse east/west art ไม่ถูกอ้างว่ามี eight-direction attacks แล้ว
- ที่ direction transition รักษา foot anchor/gait phase และใช้ declared fallback
- Snapshot equipment/art version ของ committed action เพื่อไม่ให้ weapon swap กลางท่าเปลี่ยนอาวุธที่ปล่อยไปแล้ว
- Baked equipment frame กับ modular equipment layers ต้องมี suppression rule เดียว ป้องกันดาบ/โล่ซ้อนสองชุด
- Offhand active/held/stowed ตาม visual profile ที่สอดคล้อง current equip rules. ไม่เปลี่ยน stats/eligibility จากการซ่อน layer

### 5.2 Per-frame attachments

ต้องมี feet, main/offhand grip, blade/tip/muzzle และ shield-front ที่ action ใช้จริง พร้อม coordinate space/provenance/tolerance. ใช้ untrimmed cell pixels; transform source rect/offset, anchor, mirror, scale และ stage เป็นลำดับเดียวกับ body

Release socket อย่างเดียวรองรับจุดปล่อย แต่ weapon trail ต้องมี trajectory จาก track หรือ sampled key poses. หากไม่มี tip track ให้ fallback ที่ประกาศและส่ง asset gap ไม่สร้างจุดที่วัดไม่ได้ว่า measured

### 5.3 Reach และ contact policy

- Paired decision เลือก skill+target+aim+stand point ร่วมกัน; motion reach ต้องอ่านสอดคล้อง attack profile
- Ordinary close cut/thrust มี usable stand region ที่ภาพอาวุธถึง. Skill ที่ใช้ energy extension ต้องมี visual extension/path ที่สื่อ reach จริง
- ลด generic whole-body lunge ที่ทำ planted feet ลื่น; ใช้ authored pose/weapon motion และ bounded reactions
- Body separation/reservation ไม่ทำให้ attacker ถูกผลักหลุด valid contact ทุก sample; กรณี geometry ไม่ feasible ส่ง movement/data owner
- Visual tip ไม่เป็น collider เอง. ใช้ authored gameplay shape เป็น initial authority; blade-sweep collision เพิ่มเฉพาะ profile ที่ design/implement อย่าง explicit

### 5.4 Auto combat decision ที่เลือก

ใช้decisionเดียว: `actor + action/profile + target + aim + stand goal + range policy + reason + next relevant boundary`. Movement/cast/targethighlightอ่านtupleนี้ร่วมกัน ไม่เลือกreadyrow/nearestแยกคนละรอบ

Selected priority: ended/dead/control facts → permittedcommittedaction/cancel → manualrequest → firstusable-nowrotationrowตามผู้เล่น → retainedusableapproach/approvedreplacement → basicopportunity → idle/return. Heal/buffไม่ได้แซงrotationด้วยhiddenemergencyAI;ใช้enabledconditions/orderที่ผู้เล่นตั้ง

- Autoaimมองcurrentpublicpositions/statuses/cooldowns/resources. ไม่อ่านfutureRNGหรือplayercommandที่ยังไม่commit
- Sticky targetอยู่จนinvalid/leash/reachability/manual/approvedclusterchange;strictlycloserเพียงเล็กน้อยไม่ทำtargetflip
- CandidateAoEใช้actualshapequeryและfocusconstraintsตามsection4.10. `timeToUsefulImpact = approach + preparation + travel/delay`ใช้tie/diagnosticsภายในpermittedpolicy ไม่เป็นDPSoptimizerที่เขียนทับslotorder
- Deployedfieldที่ยังusefulไม่ถูกauto-replaceทุกครั้งที่rowready. Manualrecastทำได้ตามowner;automaticreplaceเมื่อexpiredหรือgeometryไม่มีusefultargetและมีvalidnewopportunity
- Newbodies/targetdeath/cooldown/resource/control/condition/manual/geometryeventsทำdecisiondirty. Coalescequeriesในexistingclockcuts;rendererไม่triggerAI
- Global skill toggleไม่ยกเลิกpaidprojectile/fieldเอง. Manualmove/castที่แทรกใช้unpaid/paidcancellationpolicyและonependingrequestเดียว

### 5.5 Reach, contacts และ movement recovery

Currentdataใช้standardradius0.25mแล้ว และnormalmeleeprofileเป็นbody-edge0.2m: standardcentersยิงถึงที่0.7m/approachstopประมาณ0.65mตามauthoredstopratio. Reuseactualrangeprofile ไม่เอาlegacygroup`range.melee=2.1m`มาตีความเป็นbasicphysicalreachอีกชุด

Selected activecontact policy:

- Contact-boundskills เช่น Backstab/Sidestep/SkullCrack/BoneBreaker/Carnage/CleaveDown/ElementalBreak/ShieldBash/Puncture/Reap/DoubleStrike ให้SC-R author **melee-contact range reference**ในcanonicalrow/readerแทนlegacy2.1mcenterdefault. Initialdefaultคือcurrentmeleeedge0.2m;artmotion/preview/copyต้องตรงmetricใหม่
- นี่เป็นexplicitactive-range migrationที่เปลี่ยนopportunityจริง ต้องตรวจautoapproach/cost/targeting/offline/copy/queriesร่วมกัน. ไม่เก็บUIว่า2.1mแต่แอบเพิ่มreleasegate0.7m และไม่ชดเชยdamageเอง
- Cleave/Impale/GroundSlam/WhirlwindและVenomSprayมีauthoredenergy/areaextentตามcurrentrow. Physicalweaponส่วนในกับouterenergy/sprayส่วนไกลต้องอ่านแยก ไม่ยืดแขน/ด้ามให้ถึงทุกtarget
- Currentpositionที่contact-validให้hold/attackก่อนเดินอ้อม. Retainvalidreservation;unassignedactorsหาจุดในclearance/rangeannulusและradius-insetbounds
- Enumeratefinitecurrent/retained/direct/tangent/boundarycandidatesด้วยstableorderและbudget. Budgetหมดคือblocked ไม่ใช่proofว่าtargetunreachable
- Solverแยกvoluntarymotionกับbodycorrection/forcedmove. Gaitนับระยะเดินจริง;correctionไม่เร่งรอบขาหรือทำrootedcastไถล
- Stuck ladder: recheckusablehere → invalidateเฉพาะbadreservation → stabletangentwaypoint → wait/retryที่relevantboundary → acquire/returnเฉพาะownerพิสูจน์hardinvalid/unreachable
- Ordinaryranged80%เป็นpreferredmovementgoal;validattackopportunityในmaxrangeมีสิทธิ์หยุดยิงได้และholdต่อ ไม่ถอยเมื่อถูกประชิด. Skirmisherเป็นexplicitopt-inprofileเท่านั้น
- Autoavoidใช้taggedheavycommittedgroundthreatพร้อมreaction/cooldownที่author ไม่perfectdodgeordinaryshots;manualpriorityและactionlocksคงอยู่

SC-Rต้องnormalize`RangeSpec {basis:center|body-edge, meters}`ร่วมsharedtypes/readers. Legacy`range_m`เป็นcenter-basedadapterชั่วคราวเท่านั้น. Contact-boundabilitymapไปmelee-contactprofileของaction ไม่ใช่normalranged/magicreachเพียงเพราะถือbow/wand;manualsingle-targetยังเลือกactorIDและapproachจนผ่านactualpredicate. Preview/bodygap/copyต้องอ่านbasisเดียวกัน;genericcontactrangeoverlayที่ใช้standardtargetเป็นreferenceต้องไม่ถูกอ้างว่าเป็นexactthresholdของbodyoverrideทุกขนาด

Current`group`เป็นaffinity/bonusเมื่อไม่มีexplicitweaponrequirement;ไม่เพิ่มhardweaponlockให้ทุกskillเพราะชื่อหรือasset. Weapon-compatiblemotionอาจเป็นbladecut,buttstroke,staffpokeหรือunarmedcontactตามของจริง. Impaleไม่เสกหอกให้ผู้ถือดาบ และBackstabไม่กลายเป็นarrowshotเพราะถือbow. ShieldBashเป็นexplicitexceptionที่SC-Xเพิ่มnonbrokenoffhandfamilyShieldrequirementในsharedeligibility/data;nos hieldใช้reasonและfallbackrotationโดยไม่spend/cooldown. Twohand+shieldslot/stat rulesคงownerเดิม โดยbashactionใช้declaredtemporaryoffhandposeไม่เพิ่มfreeoffhandswing

Preferred-stop mathต้องเคารพbasis:

```text
center profile: maxCenter = meters; preferredCenter = meters * stopRatio
body-edge profile: maxCenter = rSource + rTarget + meters
                   preferredCenter = rSource + rTarget + meters * stopRatio
lowerClearance = rSource + rTarget + authoredClearance
stopRegion = authored stop band intersected with [lowerClearance, maxCenter]
```

ห้ามคูณratioกับผลรวมcenterของedgeprofileทั้งก้อนจนเปลี่ยนระยะยืนโดยไม่ตั้งใจ. ช่องrange/clearanceขัดกันให้reportgeometryinfeasible;ไม่มีhiddenrangeเพิ่มหรือshrinkbodyเพื่อผ่านquery

### 5.6 Targetable population และ visible-world contract

- Actualspawned/alive/hostileidleunitsต้องเป็นtargetableตามprofile;การโดนจริงเพิ่มengagementตามcurrentaggro/assistdata. Visibleidlebodyไม่ใช่decorativecopyที่มีHPอีกชุดหรือimmuneเพราะอยู่นอก`s.group`array
- Core/fieldownerต้องให้targetablequeryfacadeที่resolveidentity/position/HPจากsingleauthority. ถ้าปัจจุบันยังแยกidleunitsกับcombatHPให้ทำscopedadapter/registryintegrationในSC-AI ไม่สร้างHPcopyในrenderer
- Populationbudgetอยู่`spawns.json`;renderbudgetไม่ตัดeligiblegameplayactors. Implicitarray-sliceengagementcapที่ยังมีต้องระบุและmigrateอย่างexplicitเมื่อเปิดspatialqueryใหม่ ไม่ซ่อนmissedhitsด้วยindexlimit
- Returning/evadingprofileปัจจุบันที่queryexcludeให้คงexclusionและแสดงevade/returnstateอ่านออก;ไม่ให้impactsuccessflashทั้งที่รับdamageไม่ได้. Dead/pending-spawn/nonhostileไม่กลายเป็นtargetจากภาพที่ยังค้าง
- Ally/self/heal/auraqueriesแยกจากhostilequeriesและใช้stateของrecipientจริง. Backgroundpaintingไม่กลายเป็นline-of-sightwallจนมีauthoritativeobstaclegeometry
- Fieldentry/exit/presenceอ่านauthoritativepositionsในmovement/eventcutsที่มี. Interpolatedrenderpositionไม่applystatusหรือaggro. ความละเอียดของmovementstepกับdisplayframeแยกในevidence ไม่อ้างcontinuous3Dphysicsที่ระบบไม่ได้ทำ

### 5.7 Motion sampling ที่ปิดข้อผิดพลาดพื้นฐาน

- Piecewisemapsemanticsegments`[T0,T1)`ไปauthoredclipmarkers`[C0,C1)`ด้วยnormalizedtime;zero-lengthsegmentstepboundaryโดยไม่หารศูนย์
- Sourceframecountไม่เพิ่มrecovery. Missingfastcontactframeจากrenderhitchใช้recentimpactcue ไม่เลื่อนdamageหรือreplayทั้งattack
- Walkphase=`fract(seed + voluntaryDistance/strideM)`จากauthoritativesamples ไม่สะสมต่อRAF. แยกwalk/forced/correction/discontinuityและรักษาphaseข้ามdirection
- Boundedhistoryเก็บtransientphase/directioncheckpointที่retainedfloorพร้อมpredecessorsample;trimadvancecheckpointก่อนลบ. Seekนอกwindowreport/clamp ไม่สร้างประวัติจังหวะเท้าขึ้นใหม่
- Committedattackdirectionอ่านจากaction;movementfacinghysteresisอ่านcapturedsamples. Sameplayheadต้องได้frame/socket/phaseเดียวที่30/60/144renderFPS
- Freezeequipment/artidentityเมื่อactioncommit;proceduralattachmentsกับbakedcontactposesไม่วาดซ้ำ. Offhandappearanceไม่สร้างsecondhitหรือเปลี่ยนstatsเอง

## 6. Resolved contacts และ feedback

### 6.1 หนึ่ง impact อาจมีหลาย recipients

Outcome ต้องมีหรือ resolve snapshot ของ recipient identity, timestamp, hit point/approach normal ที่ presentation ใช้, result และ relevant status/consume facts. Reuse report/receipts ที่มี; เพิ่ม minimal contact facts เมื่อ CP inspection พิสูจน์ว่าขาด ไม่สร้าง damage transaction อีกชุด

- Primary target ไม่เท่ากับ all hit targets. Cone/line/splash ใช้ actual recipients; projectile interception ใช้ actual body
- Contact presentation เลือก body surface ด้านที่แรงเข้ามาหรือ declared body attachment ตามชนิดสกิล; ห้ามเปลี่ยน hit membership จาก visual point
- Contact burst fixed ที่ impact snapshot แล้วสลาย; status mark ตาม recipient; field ตาม world anchor ของมัน
- Successful-hit, block, dodge, miss, absorption, crit, execute/death ใช้ facts จริงและ dedupe ด้วย impact/recipient identity
- Lightweight flinch ไม่กลบ protected release/contact หรือเปลี่ยน cadence. Actual hard control/death ใช้ lifecycle owner

### 6.2 Payload/field/cancel cases

- Release → independent payload lifetime; caster recovery ไม่รอ arrival
- Fixed field ใช้ committed center; mobile channel ใช้ caster sample/pulse position; target-attached state ตาม recipient
- Target loss ก่อน release/หลัง release แยกตาม delivery. Source death ไม่ลบ released work นอก policy
- Multi-launch/burst/chain ใช้ launch/contact identities จริง; texture repeats ไม่สร้าง hits
- Source/target generation เปลี่ยน, area exit, replace/expiry และ interruption ต้องมี explicit end reason; cleanup visuals/caches ตามนั้น
- Ground cast ว่างยังมี paid action/effect ได้. การไม่มี hit recipients ไม่ใช่เหตุซ่อน whole spell

### 6.3 Impact transaction และ selected scope rules

Oneimpactเป็นtransaction: validatearena/source-policy/recipient → queryeligibility/contact → cachedrolls/targetdefence → actualpoolloss/status/consume/spread → death/reward/triggerreceipts → presentationfacts. ใช้currentformula/orderingowners ไม่สร้างdamage pathแยกสำหรับnewVFX

| เรื่อง | Selected default/contract |
| --- | --- |
| Offence inputs | Prepare/commit snapshotตามcurrentactionowner;visualไม่recalculateattackจากgearใหม่ |
| Defence/location | อ่านliveimpactfactsตามeffectowner;fixedareaไม่guaranteehitเป้าที่เดินออกไป |
| Crit | หนึ่งcast-levelrollที่firsteligibleimpact;cacheทั้งcast. Basicแต่ละครั้งเป็นactionแยก;visualshardsไม่rollcrit |
| Accuracy/dodge | หนึ่งcachedcast-targetrollที่firsteligiblecontactของtargetนั้น;scheduledsharesreuseผล ไม่rollตามtextureframe |
| Skill status/explicit stacks | Defaultonceต่อsuccessfulcast-target;newtargetในfieldได้first-successentitlementของตัวเอง. Dataที่ระบุscopeต่างต้องexplicit |
| Generic on-hit riders | Defaultonceต่อcast-targetสำหรับcompatibility;ArrowShowerเป็นselectedexplicitimpact-targetexceptionเพื่อรองรับeach-arroweffectintent ต้องauthorflag/reader/copyให้ตรง. ไม่broadcastprocจากdecorativecount |
| Cast-on-crit / damage-taken aura | CoCไม่เกินหนึ่งacceptedtriggerต่อsourcecastที่critจริง;damage-takenไม่เกินหนึ่งต่อincomingactionที่มีeligiblepoolloss. ICD/lineageยังต้องผ่าน |
| Spread/consume/payoff | Ordering/entitlementต่อcast-targetต้องมีreceipt;repeatsไม่spendstatusซ้ำหรือทำpreparedpayoffหายเพราะส่วนแรกconsumeไปแล้ว |
| Leech/execute | คำนวณจากactualeligiblepoolloss/threshold;nohealfrommiss/overkillและnodeathreceiptซ้ำ |
| Trigger lineage | Root/parent/triggeridentity+ICDsตามengine;finiteacceptedchainและdeterministicsecondaryordering ไม่ให้visualloopreenterproc |
| Fatal/arena end | Existingfatallatchชนะlateheal/lateprimary;cancelended-arenaworkตามreceipts |
| Save/replay | Payment,cooldown,impactindex,rollcache,status/death/reward/RNGprogressต้องสอดคล้องที่eventboundary |
| Feedback amounts | Outcomeownerแยกfinalmitigatedhit,poolloss,absorb,overkill,restorationและpaidleech. Defaultdamagefloaterอ่านmitigatedhitก่อนoverkillclamp;bars/summary/creditอ่านactualpoolsตามmeaning ไม่ให้UIคำนวณสูตรใหม่ |

High-speed/largepacksเป็นworkloadที่ต้องรองรับ. Presentationcoalesceflash/text/particlesตามpriorityได้ แต่ไม่dropdamageeventsหรือเปลี่ยนprocจำนวนครั้งเพื่อทำFPS

SC-Eต้องmapactualkeystone/riderconsumersเข้าสู่scopeเหล่านี้และupdatecopyที่ยังพูดกำกวม. Same trigger identityบนactorเดียวactivateได้ไม่เกินหนึ่งครั้งต่อrootlineageร่วมกับICD;reflecteddamageไม่recursive-reflectโดยdefault. ข้อขัดกันกับcurrentbehaviorเป็นexplicitmechanicmigrationที่ต้องมีbefore/afterevidence ไม่แก้ด้วยการdropsecondaryeventqueue

Damageprimaryแยกจากaimtarget: AoE/line-primarysharesรักษาoriginalcommittedprimaryและsecondaryrulesของowner;single-contactprojectileใช้actualrecipientของpayloadนั้น;SplitShotbinddamageprimaryเมื่อfirstactualcollisionแล้วคงไว้ในsplashนั้น. ไม่มีการpromoteotherbodyเป็นfullprimaryซ้ำเพียงเพราะตัวเดิมตาย. Remainingburstshotsยังใช้committedaimตามprofileและcast-targetentitlements ไม่autohomeหรือกลายเป็นnewcast

### 6.4 Closed semantic migrations ของสกิลที่ยังไม่ครบตามเจตนา

SC-Xทำdata/execution/ledger/copy/VFXhandoffพร้อมกัน. ข้อเลือกต่อไปนี้เป็นtargetdesignใหม่ที่ต้องimplement ไม่ใช่คำอ้างว่าปัจจุบันทำแล้ว:

| Skill | Selected execution |
| --- | --- |
| Water Ball | Explicitprojectile-burst: count/shareจากcurrenteffects5×20%, initialinterval0.12s,onecommittedaim,individualcontacts;castpaymentครั้งเดียว |
| Double Strike | Explicitmelee-burst:2×60%ตามcurrenteffects,initialgap0.12sที่basespeedและscalesตามdeclaredattacktimingprofile;revalidatecontactที่แต่ละblow,จบremainingblowsเมื่อactualcancel/targetlost |
| Split Shot | Explicitprojectile-impact-area:หนึ่งmissile,firstactualcollisionสร้างcircleที่actualcontactpointแล้วqueryliverecipients;firstcollidedbodyเป็นdamageprimaryที่bindครั้งเดียว,fragmentsหลังแตกเป็นcosmeticไม่hitเพิ่ม |
| Storm Field | Explicitpersistent-fieldตามcurrentcircle/dot8s:initialpressตามcoeffเดิม +25DPSที่1sintervalหลังactivation,8paymentsเมื่ออยู่ครบ;disablelegacyattached-erosionpathของcastนี้ |
| Poison Cloud | Explicitpersistent-fieldตามcurrentcircle/dot8s:initialpressเดิม +15DPSที่1sintervalหลังactivation,8paymentsเมื่ออยู่ครบ;poison2stacksใช้once-per-cast-targetที่firstsuccess ไม่เพิ่มทุกpulse |
| Blizzard / Sand Storm field schedule | Newcastsnormalizeactivationไปactualgroundlandingตามresolvedgroundprofile. Blizzardไม่มีadditionalinitialpress:20×5%ที่activation+k×8s/20,k=1..20. SandStormมีinitialpressที่activationแล้ว10×20DPSpaymentsที่activation+1..10s. Budget/countเดิมคงแต่timelineเป็นexplicitmigration |
| Meteor/Firestorm | คงcurrentone-pressgroundmodelกับcosmeticmulti-objectchoreographyที่เลือกแล้ว. ไม่มีlongbombardmentdamageหรือfieldDPSใหม่จากการวนภาพ |
| FrostNova/CinderNova/ThunderStorm/ChaosWave | Currentinstantcaster-novas;ไม่มีpersistentfieldหรือtravellingfrontที่ชื่ออาจทำให้เดาผิด |
| Ignite/VenomBolt/Entropy/Catalyst/Ruin | ใช้currentinstant/single/payoff/statusmodel;ไม่สร้างtravellingprojectileจากคำว่าBoltหรือadditionalspreadhitsที่ไม่มีreceipt |
| ThunderStrike/EarthSplitter/StoneSpike | Groundsingle/contactprofile:skycolumn,groundfractureหรือrisingeffectตามPart2 โดยไม่เพิ่มAoEหรือcontrolนอกdata |

Burstbudgetต้องใช้count×authoredshareจริง ไม่normalizeทุกสกิลให้รวม100%: currentWaterBall5×20=100%,IceLance2×55=110%,ArrowShower3×40=120%,DoubleStrike2×60=120%,Overload2×50=100%,Blizzard20×5=100%. Whirlwindที่ไม่มีhit_pctใช้ownerdefaultเดิม ไม่หั่นงบdamageเอง. ValuesresolveจากeffectsAtที่release ไม่คัดตารางเข้าUI

Truefieldsหนึ่งactiveinstanceต่อcaster+skill+arena;manualrecastreplacefutureworkโดยไม่refund/undooldhits. ต่างskillอยู่ร่วมได้ตามstatusstackingowner. Expirycleanupเกิดหลังlasteligiblepulseที่timestampเดียวกันตามexistingpending-damage/expiryordering;replacementกับpulseเวลาซ้อนใช้CombatClockcomparatorเดิม

Field-v2timelineที่เลือก: `activationAt = resolvedGroundLandingAt`, `expiresAt = activationAt + duration`;initialpressมีเฉพาะprofileที่ระบุ,periodicpaymentsเริ่มafter-intervalและรวมlastpaymentที่expiry. Blizzardวงเต็มเมื่อcoldfieldเริ่มแล้วpulseแรกตามอีก0.4s;หากแสดงfirst-damagecountdownให้ใช้quietpulseindicatorแยก ไม่เรียกช่วงนั้นว่ายังร่ายอยู่

Existingreleased/pendingworkเก็บactuallegacydeadlines/receiptsตามledger. Newcastsใช้newscheduleversion;loadmigrationไม่rebasepaidlegacyBlizzardจากrelease+0.4ไปnewmodelหรือเพิ่มunspenthits. Compiler/serializerต้องเก็บsemanticversionหรือfactsที่แยกได้พอโดยไม่เปลี่ยนmeaningของsaveเก่า

Newtargetsเข้าฟิลด์รับactualdamage/first-successstatusตามscope;ออกฟิลด์ไม่พกfieldDPSไปเอง. Presence-onlymodifiersลบเมื่อexit/replaced/expired;DoTstatusที่มีownerแยกยังใช้lifecycleของมัน. Spatialopportunityที่เปลี่ยนจากtarget-attachedเป็นfieldต้องรายงานก่อน/หลังพร้อมsave/offlinepolicy ไม่ตีความเป็นcosmetic-only

### 6.5 Primary opportunity, field lifetime และfailure rules

- Oneactorมีoneprimaryslot. Releasedpayload/fieldอยู่ต่อได้อิสระ แต่basicbeatที่ถูกprimaryblockไม่ถูกbankเป็นunlimitedburstไว้ปล่อยทีเดียวหลังrecovery;บันทึกwithheldreasonตามcadenceowner
- Speculativeeligibility/aim/previewไม่spend,rollRNG,grantXPหรือstartcooldown. Releasecommitครั้งเดียว;actualmissยังใช้paidcost/cooldownของมัน
- Source/targetdeath,hardcontrol,manualmove,replaceและareaexitต้องได้terminal/cancelreasonที่ทุกconsumerอ่านตรงกัน. NoUIcallback resurrectsactorหรือsettlesreward
- Truefieldlifetime/damagepayments/presencemodifierใช้scheduleและcleanupownerเดียว. At-expiryfinalpulse/replace-same-timecasesใช้explicitreceipt/comparator ไม่ขึ้นกับarrayiterationหรือtextureend
- Field/area/bodyqueriesตัดinvalid/nonhostile/deadตามprofile. Hitcap/SingleCombat/primary-shareอ่านgameplayowner ไม่ให้VFXเพิ่มtargetจากรายชื่อที่เห็นบนจอ
- Invalidnewexecutionprofile/NaN/negativephaseก่อนcommitให้refusal/diagnosticที่owner;missingtextureเป็นvisualfallback ไม่rollbackpaymentที่ถูกต้องหรือปล่อยphysicalcastสองครั้ง

### 6.6 Save, offline และmode transitions ที่เลือก

Sameaction/impactexecutioncoreใช้onlineและoffline;recipientadapterของofflineเป็นdocumentedqueueapproximation. ไม่กล่าวอ้างspatialfarmingผลเท่ากันทุกseed แต่cost/cooldown/hitshare/procs/receiptsของprofileเดียวกันต้องไม่กลายเป็นคนละmechanic

1. Releasedonlineworkที่บันทึกแล้วsettleด้วยpreparedfacts/rolls/lastknownactor-contextตามpendingownerครั้งเดียว;offline/loadไม่ใช่เหตุcancelpaidworkเอง
2. Newofflineactionsใช้sameclock/lifecycleกับqueue-targetadapter;ไม่มีrenderer,particlesหรือcosmeticRNG และไม่ข้ามfatal/cancellationrulesเพื่อเร่งcatch-up
3. Returnonlineสร้างpresentationจากcurrentstate/retainedfacts ไม่replayoldimpact/loot. Fieldidentity/archive/spawnentitlementไม่rerollเพราะเปิดScene
4. Intentionalworldtravelใช้existingonline-onlytravel/road/boss/campcontracts;endingarenaจบfutureworkด้วยreceiptsที่ชัด ไม่เอาoldfielddamageไปลงnewhex
5. Persistpuredataที่จำเป็น:ids/epoch/generation,preparedinputs,cachedroll/effectscope,per-payloadprogress/visitedtargets,fieldtimes/presence,resource/HP/status/death/reward/RNGprogress. Commitที่completeeventboundaries
6. Cosmeticframe/DOM/filter/particleloopไม่เข้าsave. Geometry/profilemigrationsผ่านsinglecompatibilityownerและold-save/round-trip/unknown-versioncases;counts/progress/meaningยังต้องรักษา

SC-Pต้องcheckpointactiveprimarypreparation/recoveryและpendingmanualintentเป็นpuredataเท่าที่จำเป็นต่อmeaningfulresume รวมnewprofile/scheduleversion;ไม่serializeclosures. Olderunsupportedunpaidintentใช้declaredcompatibleinitialization แต่paidreceipts/entitlementsห้ามหาย. Pendingreleasedlegacyrecordใช้savedpreparedvalues/radius/timing แทนre-readnewrowแล้วreinterpretอดีต

RNGpolicy: preservepersistedstreams/cachesและno-render-draw. Newlegitimatetargets/fields/ArrowShowerexceptionอาจเปลี่ยนfutureeventinterleaving/drawsตามexplicitmechanicmigration จึงต้องรายงานไม่อ้างcross-versionfutureoutcomeidentical. ห้ามreseedonload/rerollstoredspecialloot/entitlementsหรือเพิ่มdrawจากpreview/particlecount

### 6.7 Contract diagnostics และtime accounting

Devinspectorต้องชี้actor/action/payload/impact/profile,phase/deadlines,rangebasis+actualgap,aim/lock,height/space,recipient/contact/result,decision/blockedreason,assetversion/socketprovenanceและterminalreason. Boundedlocaltraceไม่เป็นtelemetryserviceหรือplayer-facingimplementationdump

Measureapproach/blocked/primarybusy/payloadpending/fieldactiveแยกกัน. Clear-timeanalysisใช้intervals/criticalpath ไม่sumทุกflight/fieldlifetimeทับกันเป็นเวลาที่actorต้องรอ. Peak/contacttime,source-to-contactresidualและframepacingเป็นevidenceคนละชนิดกับdamage/XPthroughput

## 7. Core implementation packets และ early proof

SC0 เริ่ม read-only ได้; packet อื่นเปิดเมื่อ current interfaces ของ predecessor ตรวจแล้ว. การตรวจมีไว้เตรียม change ใหม่ ไม่เป็น gate ย้อนทำแผนเก่า

| Packet | งานที่ต้องทำ | Dependency | ผลรับงาน |
| --- | --- | --- | --- |
| SC0 — Current inventory | Enumerate live skills/mob profiles, current consumer paths, feature/evidence status และ owner map | Source ปัจจุบัน | ต่อ row ระบุ implemented/mismatch/asset-gap/unverified และ reproduction controls |
| SC1 — Normalize handoff | Sections3.1–3.7: compiledexecution spec,ids/clocks/as-of/shape/height/anchors/effectscopeและknownlegacyadapters | SC0 | Currentliveinventoryไม่มีambiguousnewprofile;owner/schema/unit/fallbackscopeชัด |
| SC-Z — Height/space foundation | Commoncameraheightprojection,body/socketheightprofiles,trajectory/elevation/depthadapters | SC1 + currentcamera/artmetadata | Ground/direct/arc/verticaldrop/risingและcontactsไม่มีpixel-liftสูตรแข่ง;noheightimmunityfromart |
| SC-T — Timing/speed migration | Onefactorresolver,explicitattack/cast/fixedmodes,phasecadence/retime/cooldowncompatibility | SC1 + engine/stat/clockowner | Speedมีผลกับdomainที่เลือกครั้งเดียว;basicprogress/skillCD/payload/pulsesไม่คูณตามUI |
| SC-R — Contact-range migration | RangeSpecbasis,contact-boundrows/meleecontactreference,query/approach/copy/preview | SC1 + currentnormalprofiles | Activephysicalcontactถึงจริงและbodyoverridesใช้metricถูก;area/energyrowsไม่ถูกย่อทั้งหมด |
| SC-E — Outcome scope | Impacttransaction,cachedrolls/status/consume/leech/triggerlineageและexplicitArrowShowerexception | SC1 + currentformula/riderowners | Count/budget/proc/killreceiptsdefinedและfinite;newvisualsไม่เพิ่มmechanicsเอง |
| SC-X — Semantic completeness | WaterBall/DoubleStrike/SplitShot/StormField/PoisonCloudและShieldBashrequirementตามsection6.4/5.5 | SC1/SC-E + scheduler/data/saveowners | Individualhits/splash/truefield/eligibilityตรงselecteddesignพร้อมcopy/old-savecoverage |
| SC-AI — Target/query foundation | Targetablepopulationfacade,paireddecision/dirtyepochs/range/reasons/field-recastpolicies | SC1 + currentfield/HPauthority;SC-Rcontract | Visibleidleactors/engagement/HPไม่แยกtruth;auto/manual/rotationไม่มีhiddenoverrides |
| SC2 — Direction/shape | Aim→lock→world geometry→projected footprint→component orientation; cone/sweep distinction | SC1 | ทุก quadrant/edge ตรงกัน; preview ไม่เลือก victim ใหม่ |
| SC2-G — Directional archetypes | Sections4.6–4.10: direction-targetinput,sector/line-impact/travelling projectile,actualwidth/endcap/rangepolicies | SC0current query inventory + SC1 | ต่อ row มี archetype/metric/lock/indicator ชัด และไม่มี old-plan/external-code assumptions |
| SC2-L — Cast/landing timeline | Resolve preparation/release/first landing/field pulses, geometry tracking/lock และ cancellation facts สำหรับวง | SC1 + SC2 geometry/current action schedule | Countdown อ่านเวลาเดียวกับ actual impact, empty ground/field/reload/retime ถูก และไม่สร้าง UI-owned scheduler |
| SC3 — Motion/weapon binding | Phase remap,gait/checkpoint,per-framegrips/tips,equipmentsnapshot,mirror/depth/reactions | SC1 + frozenSC-Z/SC-Tcontracts + actualartcapability | Pose/release/contact/primaryend/heightตรง;missingartไม่ถูกอ้างว่าครบจากfallback |
| SC4 — Contact/results | Per-target contact snapshots, outcome cues, dedupe, actual projectile terminal | SC1–SC3 | Hit/miss/block/multi-target/death สอดคล้องกัน |
| SC4-P — Piercing continuation | Per-recipientcontinuouscontact,visitedset/rollsharecache,clockcuts และ pendingledger | SC2-G + currentmotion/CombatClock/saveowner | PiercingShot ไม่ applydamage ท้าย lane ที่ firstcontact;ลำดับ/ครั้ง/HP/cost/save ถูก |
| SC5 — Approach/AI | Sections5.4–5.7: skill+target+aim+stand,clearance/rolelocks,threatresponseและenemytelegraphs | SC-AI/SC-R + SC1–SC4subsets | Meleeถึงจริง,cone/rangedใช้ตำแหน่งถูก,noorbit/noresource-waitloopและblockedreasonsตรวจได้ |
| SC6 — Temporal families | Bursts/chain/fields/channels/DoT/state lifecycle และ cancel/save/online-offline transition | SC-X/SC-E + currentscheduler/persistence | ไม่มีfakepulse/duplicate receipt/strikestretch;fieldentry-exit/expiryและnewprofilesครบ |
| SC7 — Core coverage | Wholecurrentroster/mobprofilesด้วยworkingart/diagnostics รวมnewselectedmigrations | ทุกmandatorySCpacketก่อนหน้า | Corecorrectness,range/speed/effectscope/height,autoAI/save/landing/piercingแยกหลักฐานชัด |
| SC8 — Joint visual acceptance | รับ revised VFX/actor candidates จาก Part 2 ตรวจ normal-speed actual arena | SC7 patterns ready + VFX candidates ต่อ family | แต่ละ promoted skill มี complete visual/action/impact agreement |

Early vertical proof ใช้ **Cleave, Venom Spray, Impale, Shield Bash, Ground Slam, Whirlwind** ก่อน whole-roster expansion. เพิ่ม projectile หนึ่งตัวและ Blizzard เพื่อพิสูจน์ independent flight กับ fixed field. ทำ subsets ของ SC2–SC4 ร่วมกันใน host ตั้งแต่ต้น ไม่เขียน subsystem ทั้งหมดแล้วค่อยเชื่อม

Landing proof เพิ่ม **Meteor + Blizzard + enemy Boulder Toss** เพื่อเทียบ fixed ground delay, field-first-pulse schedule และ hostile ground threat. SC2-L/VF2-L ใช้ procedural geometry กับ working assets จึงตรวจ countdown ได้โดยไม่รอ candidate artwork ใหม่

## 8. Ownership, persistence และ performance

- Core integrator คนเดียวดู `sim/core/game.ts`, action/arena/types/field/pending structures; Scene integrator คนเดียวรวม props/helpers
- Contributors แยก pure geometry/sampling, metadata, skill families และ asset directories ตามขอบเขตที่ไม่ทับกัน
- Save owner review เฉพาะ gameplay ledger/geometry data ที่ change ต้อง persist; frame index/DOM/texture state ไม่เข้า save
- Reuse existing scheduler, RNG streams และ receipts. Cosmetic randomization stable ต่อ action และไม่ consume gameplay RNG
- Bound history/cache/component work; seeking จำกัด retained window และใช้ transient checkpoint ที่ reconstruct ได้
- LOD/offscreen culling ลด decoration ก่อน geometry/threat/contact; ไม่ลบ gameplay event
- Reduced motion คง footprint, aim/commit state, contact และ expiry พร้อมลด spin/shake/strobe
- ไม่เพิ่ม renderer/library/physics framework เป็น prerequisite โดยไม่มี profiling/contract evidence

## 9. Acceptance และ verification สำหรับ implement

| Scenario | Proof ที่ต้องมี |
| --- | --- |
| Cone all directions | Apex/axis/full opening/reach ตรง query; front/side/back targets ได้ผลถูก |
| Tracking→lock | Moving target ก่อน lock ติดตามตาม policy; หลัง lock cone/VFX ไม่หันตาม |
| Sweep vs one impact | Dominant contact beat ตรง scheduler; ไม่มี hit ตาม atlas frame |
| Pointer/projection | World/view round-trip และ stage/camera offsets ตรง; asset forward axis ถูก |
| Melee/weapon/offhand | Grip/tip/shield anchor ติดตาม pose และ equipment snapshot; planted feet นิ่ง |
| Multiple recipients | หนึ่ง sweep + real contacts รายตัว; target cap/eligibility/Single Combat อ่านจาก owner |
| Interception/miss/pierce | Terminal point/time/recipient ตรง; end cue เดิมไม่ออกซ้ำ |
| Fixed/mobile effects | Field คงที่/channel ตาม caster/mark ตาม recipient ถูกทั้ง move/cancel/expiry |
| Cast and landing clocks | Cast progress จบที่ release แต่ landing progress จบที่ first landing จริง; instantaneous/field-first-pulse ไม่ใช้ generic delay ผิด |
| Landing preview/commit | ระหว่าง approach ไม่มี countdown ปลอม; ก่อน lock ตามได้ตาม policy หลัง lock ring อยู่กับ committed shape รวมพื้นว่าง |
| Landing pause/retime/cancel | Arc/remaining ใช้ combat time, as-of revisions และ real end reason; no impact/reward จาก animation completion |
| Empty ground/source death | ภาพและ retained work ตาม actual lifecycle ไม่มี phantom hit |
| Speed/pause/seek/hitch | Sample timestamp เดิมได้ state เดิม; no double speed/no replay storm |
| Save/area/generation | Paid pending work ถูก, old event ไม่ติด actor ใหม่, caches คืนทรัพยากร |
| Dense combat/reduced motion | Actors/hostile preparation/shape อ่านได้ และ sim ไม่เปลี่ยนตาม render quality |

Existing owner checks ที่ต้องพิจารณาตาม affected surface: `skill-area.test.ts`, `combat-timing.test.ts`, `combat-arena-view.test.ts`, `combat-presentation.test.ts`, `combat-arena.test.ts`, `combat-acceptance.test.ts`, `pending-work.test.ts`, `field-area.test.ts`, `arena-space.test.ts` ใน `game/tests/`. เพิ่ม meaningful negative cases ที่ coverage ขาด ไม่สร้างชุดทดสอบซ้ำ implementation

รอบ implement ใช้ relevant focused tests/cages, `npm run typecheck`, `npm --prefix game run check`, `npm --prefix game run build` ตาม AGENTS. Browser จริงที่ **1920×1080** บน existing port 5173: `http://localhost:5173/__showcase?sample=arpg-arena`. Skill FX Lab ช่วย diagnose แต่ไม่แทน live arena proof

รอบเขียนเอกสารนี้ตรวจ source references/links/coverage เท่านั้น. การแก้ behavior จริงจึงปรับ affected game-rule/wiki sections และ build wiki ตาม owner

## 10. Completion และสิ่งที่ต้องรายงาน

Core complete เมื่อ current live inventory map เข้า contract ถูก, direction/shape/motion/contact/lifecycle และ cast/landing timeline ผ่าน relevant cases พร้อม exact evidence ของ changed code. Asset ที่ขาดระบุ pending ต่อ id/profile; new-art promotion รอ Part 2 ของ candidate นั้นโดยไม่ block independent core work

Handoff ระบุ changed files, accepted interface, actual commands/results, browser scenarios, remaining art/semantic conflicts และ compatibility limits. แผนนี้เป็นเอกสารงานรอบใหม่; ไม่มีคำอ้างว่า runtime หรือ VFX ผ่านแล้วเพราะเขียนแผนเสร็จ
