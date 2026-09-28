package com.modder.mijn_eerste_mod.gui;

import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.level.Level;

/**
 * Werkbank-GUI "glitchbench" (modus: crafting → werkt met alle recepten uit de tab Werkbanken).
 * Slots worden na super() naar jouw ontwerp-positie verplaatst.
 */
public class MijnWerkbankMenu extends CraftingMenu {
    /** Slotposities: {vanillaX, vanillaY, ontwerpX, ontwerpY} */
    private static final int[][] SLOT_POS = {
            {124, 35, 116, 42}, // uitvoer
            {30, 17, 50, 33}, // invoer 0
            {48, 17, 32, 33}, // invoer 1
            {66, 17, 50, 51}, // invoer 2
            {30, 35, 32, 51}, // invoer 3
            {8, 84, 8, 84}, // speler inv 9
            {26, 84, 26, 84}, // speler inv 10
            {44, 84, 44, 84}, // speler inv 11
            {62, 84, 62, 84}, // speler inv 12
            {80, 84, 80, 84}, // speler inv 13
            {98, 84, 98, 84}, // speler inv 14
            {116, 84, 116, 84}, // speler inv 15
            {134, 84, 134, 84}, // speler inv 16
            {152, 84, 152, 84}, // speler inv 17
            {8, 102, 8, 102}, // speler inv 18
            {26, 102, 26, 102}, // speler inv 19
            {44, 102, 44, 102}, // speler inv 20
            {62, 102, 62, 102}, // speler inv 21
            {80, 102, 80, 102}, // speler inv 22
            {98, 102, 98, 102}, // speler inv 23
            {116, 102, 116, 102}, // speler inv 24
            {134, 102, 134, 102}, // speler inv 25
            {152, 102, 152, 102}, // speler inv 26
            {8, 120, 8, 120}, // speler inv 27
            {26, 120, 26, 120}, // speler inv 28
            {44, 120, 44, 120}, // speler inv 29
            {62, 120, 62, 120}, // speler inv 30
            {80, 120, 80, 120}, // speler inv 31
            {98, 120, 98, 120}, // speler inv 32
            {116, 120, 116, 120}, // speler inv 33
            {134, 120, 134, 120}, // speler inv 34
            {152, 120, 152, 120}, // speler inv 35
            {8, 142, 8, 142}, // speler inv 0
            {26, 142, 26, 142}, // speler inv 1
            {44, 142, 44, 142}, // speler inv 2
            {62, 142, 62, 142}, // speler inv 3
            {80, 142, 80, 142}, // speler inv 4
            {98, 142, 98, 142}, // speler inv 5
            {116, 142, 116, 142}, // speler inv 6
            {134, 142, 134, 142}, // speler inv 7
            {152, 142, 152, 142}, // speler inv 8
    };

    public MijnWerkbankMenu(int id, Inventory inventory) {
        this(id, inventory, inventory.player.level(), BlockPos.ZERO);
    }

    public MijnWerkbankMenu(int id, Inventory inventory, Level level, BlockPos pos) {
        super(id, inventory, level, pos);
        // 🔧 Verplaats slots naar jouw ontwerp (match op de originele vanilla-positie)
        int[][] origineel = new int[this.slots.size()][2];
        for (int i = 0; i < this.slots.size(); i++) {
            Slot s = this.slots.get(i);
            origineel[i][0] = s.x;
            origineel[i][1] = s.y;
        }
        for (int[] q : SLOT_POS) {
            for (int i = 0; i < this.slots.size(); i++) {
                if (origineel[i][0] == q[0] && origineel[i][1] == q[1]) {
                    Slot slot = this.slots.get(i);
                    slot.x = q[2];
                    slot.y = q[3];
                    break;
                }
            }
        }
    }

    /** Werkt altijd – ook als een mob de GUI opent. */
    @Override
    public boolean stillValid(Player player) {
        return true;
    }
}
