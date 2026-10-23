<script lang="ts">
    import { eng, sm } from "../engine/client";
    import { elementIcon, skillIcon } from "../icon";
    import { ownsSkill, hpReserved, usableHp } from "../sim/skills";
    import { statusLabel } from "../sim/mobStatus";
    import { statusViews } from "../sim/playerStatus";
    import { fxOut } from "./motion";
    import Meter from "./Meter.svelte";
    import Icon from "./Icon.svelte";
    import CombatActor from "./CombatActor.svelte";
    import type { GameState, FxEvent } from "../sim/types";
    import type { Character } from "../sim/player";
    import type { Statuses, StatusName } from "../sim/combat";

    /** The actor moves independently of its fixed vitals, identity and status reads. */
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
    const takenPops = $derived(ring.filter((e) => e.side === "self" && e.kind === "taken" && e.value).slice(0, 3));
    const defenseWords = $derived(ring.filter((e) => e.side === "self" && (e.kind === "block" || e.kind === "proc")).slice(0, 3));

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
    <div class="player-actor-slot"><CombatActor {ring} {c} opponents={s.group} /></div>
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
    <div class="card-body card-combat">
        <div class="vitals">
            {#if latestTaken}
                {#key latestTaken.id}
                    <span class="flash" style="--fx:{latestTaken.colour}"></span>
                {/key}
            {/if}
                <div class="cardface">
                    <div class="identity">
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
                        <Meter
                            value={vitals.hp}
                            max={c.maxHp}
                            tone="hp"
                            label={`HP ${fmtNum(Math.max(0, Math.round(vitals.hp)))} of ${fmtNum(c.maxHp)}${hpHeld > 0 ? `, ${fmtNum(hpReach)} usable, ${fmtNum(hpHeld)} reserved` : ""}`}
                            title={hpHeld > 0 ? `${fmtNum(hpReach)} usable · ${fmtNum(hpHeld)} reserved` : undefined}
                            valueText={`${fmtNum(Math.max(0, Math.round(vitals.hp)))} / ${fmtNum(c.maxHp)}`}
                        />
                        {#if hpHeld > 0}
                            <small class="meter-note">{fmtNum(hpReach)} usable · {fmtNum(hpHeld)} reserved</small>
                        {/if}
                        {#if c.es > 0}
                            <Meter
                                value={vitals.es}
                                max={c.es}
                                tone="es"
                                label={`Energy Shield ${fmtNum(Math.max(0, Math.round(vitals.es)))} of ${fmtNum(c.es)}`}
                                valueText={`${fmtNum(Math.max(0, Math.round(vitals.es)))} / ${fmtNum(c.es)}`}
                            />
                        {/if}
                        <Meter
                            value={vitals.mana}
                            max={c.maxMana}
                            tone="mana"
                            label={`Mana ${fmtNum(Math.max(0, Math.round(vitals.mana)))} of ${fmtNum(c.maxMana)}${reserved > 0 ? `, ${reserved}% reserved by auras` : ""}`}
                            valueText={`${fmtNum(Math.max(0, Math.round(vitals.mana)))} / ${fmtNum(c.maxMana)}`}
                        />
                    </div>
                </div>
        </div>
    </div>
    <div class="rails" role="group" aria-label="Player combat effects">
        <div class="rail buffs" role="list" aria-label="Active buffs and auras">
            {#each buffMarks as mark (mark.id)}
                <span
                    class="badge-mark badge-status buff"
                    role="listitem"
                    aria-label={`${mark.label}${mark.secs != null ? `, ${mark.secs} seconds left` : ", aura active"}`}
                    title={`${mark.label}${mark.secs != null ? ` · ${mark.secs}s left` : " · aura active"}`}
                >
                    <Icon src={mark.icon} />
                    {#if mark.secs != null}<small>{shortTime(mark.secs)}</small>{/if}
                </span>
            {/each}
        </div>
        <div class="rail debuffs" role="list" aria-label="Active debuffs">
            {#each debuffMarks as mark (mark.name)}
                <span
                    class="badge-mark badge-status debuff"
                    role="listitem"
                    aria-label={`${mark.label}${mark.stacks > 1 ? `, ${mark.stacks} stacks` : ""}, ${mark.secs} seconds left`}
                    title={`${mark.label}${mark.stacks > 1 ? ` ×${mark.stacks}` : ""} · ${mark.secs}s left`}
                >
                    <Icon src={mark.icon} />
                    <small>{shortTime(mark.secs)}</small>
                </span>
            {/each}
        </div>
    </div>
</div>

<style>
    .player-card {
        position: relative;
        display: grid;
        grid-template-rows: minmax(0, 1fr) auto;
        width: 100%;
        height: 100%;
        min-height: 0;
    }

    .player-actor-slot { position: relative; min-height: 0; }

    .card-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        min-height: 0;
        padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-sm);
    }

    .vitals {
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 0;
        gap: var(--spacing-sm);
    }

    .cardface {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: stretch;
        min-height: 0;
        gap: var(--spacing-sm);
        width: 100%;
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
        display: flex;
        align-items: baseline;
        justify-content: center;
        flex-wrap: wrap;
        gap: var(--spacing-sm);
        min-width: 0;
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
        top: 24%;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-sm);
        min-width: max-content;
        pointer-events: none;
    }
    .rail.buffs {
        right: calc(-1 * (var(--icon-label) * 1.5 + var(--spacing-xs)));
        align-items: flex-end;
    }
    .rail.debuffs {
        left: calc(-1 * (var(--icon-label) * 1.5 + var(--spacing-xs)));
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
        top: 30%;
        white-space: nowrap;
        padding: var(--spacing-sm);
    }
    .pops .pop-word {
        top: 48%;
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

    .meter-note {
        color: var(--dim);
        font-size: var(--font-xs);
        font-variant-numeric: tabular-nums;
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
    @media (prefers-reduced-motion: reduce) {
        .flash,
        .pops .pop {
            animation: none;
        }
    }
</style>
