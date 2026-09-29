package com.modder.mijn_eerste_mod.gui;

import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.SimpleContainer;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.inventory.Slot;

/**
 * Vrij GUI "glitch" (modus: free).
 * Koppel hier in ai-code/ jouw eigen logica (bijv. kopen, verkopen, smeden).
 */
public class GlitchMenu extends AbstractContainerMenu {
    private final SimpleContainer content = new SimpleContainer(1);

    public GlitchMenu(int id, Inventory playerInventory) {
        super(ModScreenHandlers.GLITCH, id);

        // geen slots – voeg ze toe in de GUI-ontwerper
    }

    /** Snel-verplaatsen (shift-klik) tussen speler en GUI. */
    @Override
    public ItemStack quickMoveStack(Player player, int index) {
        ItemStack newStack = ItemStack.EMPTY;
        Slot slot = this.slots.get(index);
        if (slot != null && slot.hasItem()) {
            ItemStack current = slot.getItem();
            newStack = current.copy();
            if (index < 0) {
                if (!this.moveItemStackTo(current, 0, this.slots.size(), true)) {
                    return ItemStack.EMPTY;
                }
            } else if (!this.moveItemStackTo(current, 0, 0, false)) {
                return ItemStack.EMPTY;
            }
            if (current.isEmpty()) {
                slot.set(ItemStack.EMPTY);
            } else {
                slot.setChanged();
            }
            if (current.getCount() == newStack.getCount()) {
                return ItemStack.EMPTY;
            }
            slot.onTake(player, current);
        }
        return newStack;
    }

    @Override
    public boolean stillValid(Player player) {
        return true;
    }

    /** Inhoud van de GUI-slots (voor jouw eigen logica). */
    public SimpleContainer getContent() {
        return content;
    }
}
