# @linxin666/dsh-client-ui-plain-chat

English | [中文](README.zh.md)

Workspace-optional plain chat for the local DSH workbench, shared by its browser and Electron interfaces.

## What it does

- The empty conversation page accepts a text message without selecting a workspace. Its first send creates a session with the `workbench-chat` preset; simultaneous sends share the same creation attempt.
- The initial composer accepts text. After creation, the original conversation composer and model controls handle subsequent messages. The initial request uses the configured default model.
- Selecting a workspace opens a separate project session through the existing workspace flow, which may reuse its blank project session. An unsent home-page draft transfers only when the project's composer has no draft; chat history is not moved into that project.
- The top-level New Session action opens an empty ordinary-chat draft. Workspace-specific New Session actions retain their existing behavior. The ungrouped history heading reads Chats; existing ungrouped sessions also appear under that heading.

## Install

This is a private local plugin, outside the published aggregate and Workshop registries. It requires the official DSH `0.1.5-rc.1` client components and the repository's shared build configuration. Build the plugin, then mount its local package through the web profile's dependency and bundle registration; merely editing its source or installing Electron does not activate it.

Use the workbench installation procedure to link the package directly with pnpm and register its bundle in the profile. The current DSH plugin-link forwarding path does not reliably quote this workbench's paths containing spaces. Keep development dependencies in the external development runtime. A changed bundle registration requires a user-controlled DSH restart; do not interrupt a running service automatically.

## Config

The host derives its storage locations from `DSH_HOME`. It creates `chat-data` beside that directory and supplies its path to the browser. For this workbench, the paths are `dsh-data` and its sibling `chat-data`. Conversation persistence and model credentials remain managed by the existing DSH services.

The plugin installs its bundled preset in `DSH_HOME/.agent-presets/workbench-chat`; this directory is plugin-owned and its files are refreshed when the host plugin loads. Edit the package's preset sources rather than the installed copy. The plugin does not replace the default project preset or model configuration.

There are no plugin-specific settings. A configured default model and a connected host are required to send messages. Missing boot metadata disables initial sending and shows a restart instruction; creation failures retain the draft for retry.

## Security model

The dedicated preset contains a complete general-purpose persona without runtime-context injection. Its capability boundary hides inherited tools with an empty allow list and rejects tool execution through a scoped guard, including tools subsequently registered in the same scope. It does not mount project file, shell, web-search, or delegation tools.

The `chat-data` directory gives ordinary sessions a neutral working directory; it is not an operating-system sandbox. The restriction applies to model tool execution in this preset, not to every host feature or every third-party plugin. Model requests still use the existing provider configuration and its data-handling policy. No API keys or access tokens are stored by this plugin.

## Known limitations

- The current rc.1 integration uses a reversible component-registry decorator for the resident `ConversationRoot`, `SidebarRoot`, and `WorkspaceBrowser` entries. It preserves their injection callbacks, declared child trees, and stores. The public shadow mechanism cannot reuse those declared child trees, so this bridge requires compatibility review when the SDK changes.
- The empty-page composer supports text only. Attachments and other advanced input behavior become available through the original composer after session creation, subject to model support and the ordinary-chat tool restrictions. Files that require model file-reading tools cannot be read in ordinary chat.
- Choosing a workspace creates or opens a separate project session; it does not convert an active chat, change its preset, or transfer its message history. Existing project sessions and their model or connection blocks retain the original behavior.
- The minimal preset does not provide context compaction. Very long conversations can reach the model's context limit. Draft storage uses browser session storage and is best effort.
- Focused tests passed (17 cases). In an isolated real Web UI, a message was sent without selecting a workspace and a plain-chat session appeared with the original model controls. A live model response and activation in the existing Electron instance were not verified.
