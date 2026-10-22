<script lang="ts">
    import { eng, sm } from "../engine/client";
    import { characterIcon, elementIcon, skillIcon } from "../icon";
    import { ownsSkill, hpReserved, usableHp } from "../sim/skills";
    import { statusLabel } from "../sim/mobStatus";
    import { statusViews } from "../sim/playerStatus";
    import { bar } from "./field";
    import { plateGesture } from "./plate";
    import { fxOut } from "./motion";
    import type { GameState, FxEvent } from "../sim/types";
    import type { Character } from "../sim/player";
    import type { Statuses, StatusName } from "../sim/combat";

    /**
     * The player's own combat card: one You identity, HP/ES/Mana readouts and combat feedback.
     * Its 5:7 portrait frame uses the same width as a mob card. Buff and debuff badges
     * flank the frame on their respective sides; Game controls live together in their own bottom-right HUD region.
     *
     * App.svelte owns the sim and the read model and hands the values in; this component only presents
     * them. The card carries flash, knock, taken figures and defence words; effect rails sit outside it.
     */
    let {
        s,
        c,
        ring,
        statuses,
        vitals,
        reserved,
        onSheet,
        fxOutMs,
        fmtNum,
    }: {
        s: GameState;
        c: Character;
        ring: FxEvent[];
        statuses: Statuses;
        vitals: { hp: number; es: number; mana: number };
        reserved: number;
        onSheet: () => void;
        fxOutMs: number;
        fmtNum: (n: number) => string;
    } = $props();

    const faceMark = characterIcon();
    let cardAnchor = $state<HTMLDivElement | null>(null);

    const shortTime = (secs: number) => (secs >= 60 ? `${Math.ceil(secs / 60)}m` : String(secs));

    function defenseColour(text: string) {
        const answer = text.toLowerCase();
        if (answer.includes("block")) return "var(--es-lit)";
        if (answer.includes("evasion")) return "var(--good-lit)";
        if (answer.includes("dodge")) return "var(--gold-lit)";
        if (answer.includes("miss")) return "var(--dim)";
        return "var(--focus)";
    }

    const latestTaken = $derived(ring.find((e) => e.side === "self" && e.kind === "taken") || null);
    /** Full Max stays on the bar; a reservation only names the share a heal may not reach (`35`, `54`). */
    const hpHeld = $derived(hpReserved(c, s.skills));
    const hpReach = $derived(usableHp(c, s.skills));
    const latestLand = $derived(ring.find((e) => e.side === "field" && e.kind === "hit" && (e.via === "swing" || e.via === "cast")) || null);
    const selfArt = $derived(plateGesture(latestTaken, latestLand));
    /** The blow taken is the louder fact; a strictly newer swing of the character's own is ignored here —
     *  on a shared second the card is already away charging the field, so only a one-sided exchange
     *  leaves a knock to land on. */
    const knocked = $derived(selfArt?.gesture === "knock" && latestTaken?.sec !== latestLand?.sec);
    const takenPops = $derived(ring.filter((e) => e.side === "self" && e.kind === "taken" && e.value).slice(0, 3));
    const defenseWords = $derived(ring.filter((e) => e.side === "self" && (e.kind === "block" || e.kind === "proc")).slice(0, 3));
    let lastLungeId = -1;
    let cardAnimation: Animation | null = null;
    $effect(() => {
        const hit = latestLand;
        const card = cardAnchor;
        if (!hit || !card || hit.id === lastLungeId) return;
        lastLungeId = hit.id;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const frame = requestAnimationFrame(() => {
            if (!card.isConnected) return;
            const field = document.querySelector(".field") as HTMLElement | null;
            if (!field) return;
            const mobs = Array.from(field.querySelectorAll<HTMLElement>(".mob"));
            const target = mobs.find((mob) => mob.dataset.mobId === hit.mobId) || mobs[0];
            const sourceRect = card.getBoundingClientRect();
            const targetRect = target?.getBoundingClientRect() || field.getBoundingClientRect();
            const dx = (targetRect.left + targetRect.width / 2 - sourceRect.left - sourceRect.width / 2) * 0.72;
            const dy = (targetRect.top + targetRect.height / 2 - sourceRect.top - sourceRect.height / 2) * 0.72;
            cardAnimation?.cancel();
            cardAnimation = card.animate(
                [
                    { transform: "translate(0, 0) scale(1)", offset: 0 },
                    { transform: "translate(0, 2px) scale(.97)", offset: 0.16 },
                    { transform: `translate(${dx}px, ${dy}px) rotate(${Math.sign(dx) * 4}deg) scale(1.08)`, offset: 0.47 },
                    { transform: `translate(${dx * 0.84}px, ${dy * 0.84}px) scale(1.03)`, offset: 0.6 },
                    { transform: "translate(0, 0) scale(1)", offset: 1 },
                ],
                { duration: 500, easing: "cubic-bezier(.2, .75, .3, 1)" },
            );
        });
        return () => cancelAnimationFrame(frame);
    });

    const STATUS_ELEMENT: Record<StatusName, string> = {
        burn: "fire",
        chill: "cold",
        shock: "lightning",
        poison: "poison",
        bleed: "physical",
        mark: "chaos",
        crippled: "earth",
    };
    const buffMarks = $derived.by(() => {
        void s.clockSec;
        const marks: { id: string; label: string; icon: string; secs: number | null }[] = [];
        for (const skill of sm.of("buff") as any[]) {
            const left = s.skills.buffUp[skill.id] || 0;
            if (ownsSkill(s.skills, skill.id) && s.skills.buffs[skill.id] && left > 0) {
                marks.push({ id: skill.id, label: skill.name, icon: skillIcon(skill.id, "buff"), secs: Math.ceil(left) });
            }
        }
        for (const skill of sm.of("aura") as any[]) {
            if (ownsSkill(s.skills, skill.id) && s.skills.auras[skill.id]) {
                marks.push({ id: skill.id, label: skill.name, icon: skillIcon(skill.id, "aura"), secs: null });
            }
        }
        return marks;
    });
    const debuffMarks = $derived.by(() => {
        void s.clockSec;
        // the aggregate views come through the one status adapter (`sim/playerStatus.ts`), never a
        // second read of the raw line
        return statusViews(statuses)
            .filter((v) => v.secLeft > 0)
            .map((v) => ({
                name: v.family,
                label: statusLabel(v.family),
                icon: elementIcon(STATUS_ELEMENT[v.family]),
                stacks: v.stacks,
                secs: Math.ceil(v.secLeft),
            }));
    });
</script>

<div class="player-card combat" role="group" aria-label="Player vitals">
    <!-- the incoming figures ride above the card root, outside the cramped-layout scroller, so a rising
       number is never clipped by the body it rose off -->
    <div class="pops" aria-hidden="true">
        {#each takenPops as e (e.id)}
            <span class="pop pop-damage incoming" out:fxOut={{ ms: fxOutMs }} style="--fx:{e.colour}; --lane:{e.id % 4}">-{eng.fmt(e.value ?? 0)}</span>
        {/each}
        {#each defenseWords as e (e.id)}
            <span class="pop pop-word" out:fxOut={{ ms: fxOutMs }} style="--fx:{defenseColour(e.text)}; --lane:{e.id % 4}">{e.text}</span>
        {/each}
    </div>
    <div class="card-body card card-combat" bind:this={cardAnchor}>
        <div class="vitals">
            {#if latestTaken}
                {#key latestTaken.id}
                    <span class="flash" style="--fx:{latestTaken.colour}"></span>
                {/key}
            {/if}
            {#key selfArt ? selfArt.id : "self-idle"}
                <div class="cardface" class:knock={knocked}>
                    <div class="identity">
                        <img class="portrait card-portrait" src={faceMark} alt="" aria-hidden="true" />
                        <div>
                            <p class="name card-name">You</p>
                            <button
                                class="level-button btn btn-flat"
                                type="button"
                                aria-label={`Open character sheet · level ${c.level}`}
                                title="Open character sheet · allocate stat points"
                                onclick={onSheet}>Level {c.level}</button
                            >
                        </div>
                    </div>
                    <div class="meters">
                        <span class="meter track track-meter hp" role="img" aria-label={`HP ${fmtNum(Math.max(0, Math.round(vitals.hp)))} of ${fmtNum(c.maxHp)}${hpHeld > 0 ? `, ${fmtNum(hpReach)} usable, ${fmtNum(hpHeld)} reserved` : ""}`}
                            title={hpHeld > 0 ? `${fmtNum(hpReach)} usable · ${fmtNum(hpHeld)} reserved` : undefined}>
                            <i style={bar(vitals.hp, c.maxHp)}></i><b>{fmtNum(Math.max(0, Math.round(vitals.hp)))} / {fmtNum(c.maxHp)}</b>
                        </span>
                        {#if hpHeld > 0}
                            <small class="meter-note">{fmtNum(hpReach)} usable · {fmtNum(hpHeld)} reserved</small>
                        {/if}
                        {#if c.es > 0}
                            <span class="meter track track-meter es" role="img" aria-label={`Energy Shield ${fmtNum(Math.max(0, Math.round(vitals.es)))} of ${fmtNum(c.es)}`}>
                                <i style={bar(vitals.es, c.es)}></i><b>{fmtNum(Math.max(0, Math.round(vitals.es)))} / {fmtNum(c.es)}</b>
                            </span>
                        {/if}
                        <span
                            class="meter track track-meter mana"
                            role="img"
                            aria-label={`Mana ${fmtNum(Math.max(0, Math.round(vitals.mana)))} of ${fmtNum(c.maxMana)}${reserved > 0 ? `, ${reserved}% reserved by auras` : ""}`}
                        >
                             <i style={bar(vitals.mana, c.maxMana)}></i><b>{fmtNum(Math.max(0, Math.round(vitals.mana)))} / {fmtNum(c.maxMana)}</b>
                         </span>
                     </div>
                </div>
            {/key}
        </div>
    </div>
    <div class="rails" role="group" aria-label="Player combat effects">
        <div class="rail buffs" role="list" aria-label="Active buffs and auras">
            {#each buffMarks as mark (mark.id)}
                <span
                    class="badge badge-status buff"
                    role="listitem"
                    aria-label={`${mark.label}${mark.secs != null ? `, ${mark.secs} seconds left` : ", aura active"}`}
                    title={`${mark.label}${mark.secs != null ? ` · ${mark.secs}s left` : " · aura active"}`}
                >
                    <img src={mark.icon} alt="" aria-hidden="true" />
                    {#if mark.secs != null}<small>{shortTime(mark.secs)}</small>{/if}
                </span>
            {/each}
        </div>
        <div class="rail debuffs" role="list" aria-label="Active debuffs">
            {#each debuffMarks as mark (mark.name)}
                <span
                    class="badge badge-status debuff"
                    role="listitem"
                    aria-label={`${mark.label}${mark.stacks > 1 ? `, ${mark.stacks} stacks` : ""}, ${mark.secs} seconds left`}
                    title={`${mark.label}${mark.stacks > 1 ? ` ×${mark.stacks}` : ""} · ${mark.secs}s left`}
                >
                    <img src={mark.icon} alt="" aria-hidden="true" />
                    <small>{shortTime(mark.secs)}</small>
                </span>
            {/each}
        </div>
    </div>
</div>

<style>
    /* One style set: this card only ever mounts inside the combat scene, so the former
       generic + .combat duplicates collapse into single rules. Any figure the card raises
       is anchored inside its own box — nothing paints outside the card. */

    .player-card {
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
    }

    .card-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        height: 100%;
        min-height: 0;
        overflow-y: auto;
        padding: var(--spacing-md);
    }

    .vitals {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        gap: var(--spacing-sm);
    }

    .cardface {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: stretch;
        height: 100%;
        min-height: 0;
        gap: var(--spacing-sm);
        width: 100%;
    }
    .cardface.knock {
        animation: card-knock var(--motion-ui) cubic-bezier(0.2, 0.8, 0.3, 1);
    }

    .identity {
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: var(--spacing-sm);
        min-width: 0;
        text-align: center;
    }
    .identity > div {
        display: grid;
        justify-items: center;
        min-width: 0;
    }

    .portrait {
        width: calc(var(--icon-card) * 4 / 5);
        height: calc(var(--icon-card) * 4 / 5);
        flex: none;
        object-fit: contain;
        padding: var(--spacing-sm);
    }

    .meters {
        display: grid;
        gap: var(--spacing-sm);
        width: 100%;
        min-width: 0;
    }

    /* effect badges live inside the card's top corners, where the portrait leaves room */
    .rails {
        position: absolute;
        inset: 0;
        z-index: var(--z-floater);
        pointer-events: none;
    }
    .rail {
        position: absolute;
        top: var(--spacing-sm);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        min-width: max-content;
        pointer-events: none;
    }
    .rail.buffs {
        right: var(--spacing-sm);
        align-items: flex-end;
    }
    .rail.debuffs {
        left: var(--spacing-sm);
        align-items: flex-start;
    }

    /* the struck beat: a coloured rim stamped once per event over the vitals subtree */
    .flash {
        position: absolute;
        inset: -1px;
        z-index: var(--z-highlight);
        pointer-events: none;
        border: 1px solid var(--fx, var(--edge));
        border-radius: var(--radius-card);
        box-shadow: inset 0 0 var(--spacing-sm) color-mix(in srgb, var(--fx, var(--text)) 58%, transparent);
        animation: card-flash 0.32s ease-out forwards;
    }

    .pops {
        position: absolute;
        inset: 0;
        z-index: var(--z-label);
        pointer-events: none;
    }
    .pops .pop {
        position: absolute;
        left: 50%;
        top: 50%;
        white-space: nowrap;
        padding: var(--spacing-sm);
    }
    .pops .pop-word {
        top: calc(50% + var(--font-md));
    }

    .badge {
        position: relative;
        display: grid;
        place-items: center;
        width: calc(var(--icon-label) * 1.5);
        height: calc(var(--icon-label) * 1.5);
        pointer-events: auto;
    }
    .badge img {
        width: var(--icon-label);
        height: var(--icon-label);
        object-fit: contain;
    }
    .badge small {
        position: absolute;
        right: 0;
        bottom: 0;
        max-width: 100%;
        overflow: hidden;
        font-size: var(--font-xs);
        line-height: 1;
    }

    .name {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
        font-size: var(--font-sm);
        line-height: 1.15;
    }
    .level-button {
        justify-self: center;
        font-size: var(--font-xs);
        line-height: 1.15;
        text-align: center;
    }

    .meter {
        display: block;
        position: relative;
        width: 100%;
        height: max(var(--spacing-sm), var(--font-xs));
        overflow: hidden;
    }
    /* the HUD hands these meters already-eased values, so the keyed flinch cannot snap them */
    .meter i {
        display: block;
        height: 100%;
        width: 100%;
    }
    .meter-note {
        color: var(--dim);
        font-size: var(--font-xs);
        font-variant-numeric: tabular-nums;
    }
    /* the figure alone, on the bar's centre line: the bar's colour is what names it */
    .meter b {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        overflow: hidden;
        white-space: nowrap;
        text-align: center;
        font-size: var(--font-xs);
        line-height: 1;
        font-weight: 600;
        color: var(--text);
        font-variant-numeric: tabular-nums;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95);
        pointer-events: none;
    }

    @keyframes card-flash {
        0%,
        100% {
            opacity: 0;
        }
        36% {
            opacity: 1;
        }
    }
    @keyframes card-knock {
        0%,
        100% {
            transform: none;
        }
        30% {
            transform: translateY(var(--spacing-sm)) scale(0.98);
        }
        60% {
            transform: translateY(-2px);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .flash,
        .pops .pop,
        .cardface.knock {
            animation: none;
        }
    }
</style>
