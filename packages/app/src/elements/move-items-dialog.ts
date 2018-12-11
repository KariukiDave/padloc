import { Vault, VaultItem } from "@padloc/core/lib/vault.js";
import { localize as $l } from "@padloc/core/lib/locale.js";
import { app } from "../init.js";
import { element, property, html, query } from "./base.js";
import { Select } from "./select.js";
import { Dialog } from "./dialog.js";

@element("pl-move-items-dialog")
export class MoveItemsDialog extends Dialog<{ vault: Vault; item: VaultItem }[], VaultItem[]> {
    @property()
    items: { vault: Vault; item: VaultItem }[] = [];

    @query("#vaultSelect")
    private _vaultSelect: Select<Vault>;

    renderContent() {
        const itemsDescription =
            this.items.length === 1 ? `'${this.items[0].item.name}'` : $l("{0} Items", this.items.length.toString());

        const sourceVaults = this.items.reduce((sv, i) => sv.add(i.vault), new Set<Vault>());
        const vaults =
            sourceVaults.size === 1
                ? app.vaults.filter(v => v.getPermissions().write && v !== sourceVaults.values().next().value)
                : app.vaults.filter(v => v.getPermissions().write);

        return html`

        <style>

            .inner {
                display: flex;
                flex-direction: column;
            }

            pl-input, pl-select, button {
                text-align: center;
                margin: 0 10px 10px 10px;
                background: var(--shade-2-color);
                border-radius: 8px;
            }

            h1 {
                display: block;
                text-align: center;
            }

            button {
                display: block;
                font-weight: bold;
                background: var(--shade-4-color);
                overflow: hidden;
            }

        </style>

        <h1>${$l("Move {0} To", itemsDescription)}</h1>

        <div class="note" ?hidden=${vaults.length}>>
            $l("There is nowhere to move these items! Please make sure there is at least one other vault " +
                "to which you have write permissions!");
        </div>

        <pl-select id="vaultSelect" .options=${vaults} .label=${$l("Vault")} ?hidden=${!vaults.length}></pl-select>

        <button @click=${() => this._enter()} class="tap" ?disabled=${!vaults.length}>
            ${this.items.length === 1 ? $l("Move Item") : $l("Move Items")}
        </button>
`;
    }

    private async _enter() {
        this.done(await app.moveItems(this.items, this._vaultSelect.selected!));
    }

    async show(items: { vault: Vault; item: VaultItem }[]) {
        await this.updateComplete;
        this.items = items;
        return super.show();
    }
}
