<script lang="ts">
    import { yaml } from '@codemirror/lang-yaml';
    import { tomorrow } from 'thememirror';

    import Tag from '$lib/ui/tag.svelte';
    import { ClipboardCopy, PanelRightClose, PanelRightOpen } from 'lucide-svelte';
    import type { Snippet } from 'svelte';
    import CodeMirror from 'svelte-codemirror-editor';
    import { fly } from 'svelte/transition';
    import { createEngine } from './create-engine';
    import FlyInOutTransition from './fly-in-out-transition.svelte';

    let {
        code = '',
        title = '',
        selectedRuleInDoc,
        showDocByDefault = false,
        hideDocButton = false,

        onchange,
        size = 'md',
        fullPage = false,
        additionnalButton
    }: {
        code: string;
        title: string;
        selectedRuleInDoc?: string;
        showDocByDefault?: boolean;
        hideDocButton?: boolean;
        onchange?: (code: string, currentlySelected?: string) => void;
        size?: 'md' | 'lg';
        fullPage?: boolean;
        additionnalButton?: Snippet;
    } = $props();

    let showDoc = $state(showDocByDefault);
    let copied = $state(false);

    let iconSize = size === 'md' ? 20 : 26;
    let iconStrokeWidth = 1.5;

    function handleCopy() {
        navigator.clipboard.writeText(code);
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 3000);
    }

    let { engine, error, warning } = $derived(createEngine(code));
    const selectedRule: string | undefined = $derived.by(() => {
        if (engine && !(selectedRuleInDoc && selectedRuleInDoc in engine.getParsedRules())) {
            return Object.keys(engine.getParsedRules()).at(-1);
        }
        return selectedRuleInDoc;
    });

    const documentationIsBroken = $derived(!engine || !Object.keys(engine.getParsedRules()).length);
    $effect(() => {
        onchange?.(code, showDoc ? selectedRule : undefined);
    });
</script>

<div
    class="editor-container not-prose flex flex-col overflow-hidden
	border border-primary-100 sm:rounded"
    class:mb-8={!fullPage}
>
    <div
        class="editor-header relative flex shrink-0 items-center overflow-hidden
		border-b border-primary-200 bg-primary-50 text-center"
    >
        <button
            class="flex items-center justify-center border-r border-primary-200 text-primary-500"
            title="Copier"
            onclick={handleCopy}
            aria-label="Copier le code"
        >
            <ClipboardCopy strokeWidth={iconStrokeWidth} size={iconSize} />
        </button>

        {#if copied}
            <div
                in:fly={{ x: -10 }}
                out:fly={{ duration: 75 }}
                class="absolute left-16 will-change-transform"
            >
                <Tag {size} bgColor="bg-primary-600 text-white ">Code copié !</Tag>
            </div>
        {/if}
        <span
            class="flex-1 font-mono font-regular text-primary-500"
            class:text-lg={size === 'lg'}
            class:text-sm={size === 'md'}
            class:p-3={size === 'lg'}
        >
            {title}
        </span>
        {#if additionnalButton}
            {@render additionnalButton()}
        {/if}
        {#if !hideDocButton}
            <button
                transition:fly
                class="border-l border-primary-200 text-primary-500"
                onclick={() => (showDoc = !showDoc)}
                aria-label={showDoc ? 'Fermer la documentation' : 'Ouvrir la documentation'}
                class:saturate-0={documentationIsBroken}
                disabled={documentationIsBroken}
                class:text-slate-400={documentationIsBroken}
            >
                <FlyInOutTransition condition={showDoc && !documentationIsBroken}>
                    {#snippet ifTrue()}<PanelRightClose
                            strokeWidth={iconStrokeWidth}
                            size={iconSize}
                        />{/snippet}
                    {#snippet ifFalse()}<PanelRightOpen
                            strokeWidth={iconStrokeWidth}
                            size={iconSize}
                        />{/snippet}
                </FlyInOutTransition>
            </button>
        {/if}
    </div>
    <div class="editor flex flex-1 flex-col xl:flex-row">
        <div class="flex flex-1 flex-col overflow-auto">
            <CodeMirror
                bind:value={code}
                lang={yaml()}
                useTab
                lineWrapping
                theme={tomorrow}
                editable={true}
                styles={{
                    '&': {
                        fontSize: size === 'lg' ? '1.1rem' : size === 'md' ? '0.9rem' : '0.8rem'
                    }
                }}
            />
            <ul class="sticky bottom-0">
                {#each [...warning, ...error] as message}
                    <li class="flex whitespace-pre-line bg-yellow-100" in:fly>
                        <span class="w-14 border-r bg-primary-50"></span>
                        <span class="max-h-40 flex-1 overflow-auto p-2 first-line:font-regular"
                            >{message}</span
                        >
                    </li>
                {/each}
            </ul>
        </div>
        {#await import('./doc.svelte') then doc}
            {#if engine && selectedRule}
                <div class="publicodes-documentation" class:showDoc>
                    <doc.default
                        {engine}
                        {selectedRule}
                        onchange={(selectedRule) => {
                            onchange?.(code, selectedRule);
                        }}
                    ></doc.default>
                </div>
            {/if}
        {/await}
    </div>
</div>

<style>
    /* TODO use something else */
    @media (min-width: 1280px) {
        .publicodes-documentation {
            max-width: 60%;
        }
    }
    .publicodes-documentation {
        transition:
            opacity 0.1s,
            transform 0.1s;

        /* @apply -mb-4; */
        @apply flex max-xl:flex-col max-xl:border-t max-lg:px-4 xl:border-l;
        @apply overflow-auto xl:w-fit;

        &:not(.showDoc) {
            @apply absolute;
            @apply invisible opacity-0 max-xl:translate-y-10 xl:translate-x-64;
        }

        & :global {
            h1 {
                @apply my-2 text-xl font-regular;
                /* @apply hidden; */
            }

            h2 {
                @apply -mx-4 border-t p-4 font-regular;
            }
            h3 {
                @apply pb-2 pt-4 font-regular;
            }

            p {
                @apply my-3 font-light;
            }
            li {
                @apply my-0;
            }
            button {
                @apply mx-2 cursor-pointer rounded border border-primary-100 bg-primary-50 px-1 py-1 text-xs hover:border-primary-200 hover:bg-primary-100;
            }
            a {
                @apply cursor-pointer font-sans hover:underline;
            }

            /* Custom styling of rules list menu + layout */
            :not(.content, h1) > a {
                @apply text-primary-400 hover:text-opacity-75;
            }
            .content > a {
                @apply min-w-10 flex-1 p-2 pl-0 pr-4;
            }
            .content {
                @apply flex w-full p-0 hover:bg-slate-100;
            }
            .active .content {
                @apply bg-slate-100 font-regular text-primary-600;
            }
            .content::before {
                margin: 1rem !important;
            }
            .content > button {
                @apply h-full rounded border-0 text-center opacity-90;
                margin: 0 !important;

                width: 2.5rem;
                background: none !important;
                opacity: 0.5;
            }

            article {
                @apply w-full flex-1 pt-2 lg:pr-4 xl:border-l-0 2xl:border-r;
            }
            nav {
                padding-right: 1px;
                @apply overflow-hidden border-r-0 lg:max-xl:max-w-64 xl:max-2xl:rounded-tr xl:max-2xl:border-r xl:max-2xl:border-t 2xl:max-w-64;
            }
            #documentation-rule-root {
                @apply flex-1 items-stretch overflow-y-auto overflow-x-hidden xl:flex xl:h-full xl:flex-col-reverse xl:max-2xl:items-start 2xl:flex-row-reverse;
                & > * {
                    @apply max-w-full;
                }
            }

            #rules-nav-open-nav-button ~ span {
                @apply text-sm;
            }
            #rules-nav-open-nav-button button {
                @apply m-0 mr-4 whitespace-nowrap px-2 py-1;
            }
        }
    }

    .editor-header {
        & :global(button) {
            @apply relative w-14 self-stretch py-2 text-center transition-colors;
            @apply lg:text-xl;
            &:not(:disabled) {
                @apply hover:bg-primary-100 active:bg-primary-200;
            }
        }
    }
    .editor {
        max-height: calc(100% - 49px);
        @apply font-mono text-sm;
    }
    .editor :global {
        .cm-editor {
            @apply flex w-0 flex-1;
        }
        .cm-content {
            @apply font-mono font-light;
        }
        .cm-gutters {
            @apply flex min-w-14 bg-primary-50 bg-opacity-30 font-mono;
        }
        .cm-activeLineGutter {
            @apply mt-0 bg-primary-50;
        }
        .cm-gutter {
            &:first-child {
                @apply flex-1;
            }
            &:last-child {
                @apply w-4;
            }
        }
        .codemirror-wrapper {
            @apply flex flex-1;
        }
        .cm-activeLine {
            @apply bg-transparent;
        }
        .ͼ2 .cm-selectionBackground {
            @apply bg-primary-50;
        }
    }
</style>
