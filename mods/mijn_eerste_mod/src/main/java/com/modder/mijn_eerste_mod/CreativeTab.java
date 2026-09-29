package com.modder.mijn_eerste_mod;

import net.fabricmc.fabric.api.itemgroup.v1.CreativeModeTabEvents;
import net.minecraft.world.item.CreativeModeTabs;

/**
 * Zet alles in de creatieve-modus-tabbladen zodat je het direct terugvindt.
 *
 * ⚠️ ALS DIT COMPILATIEFOUTEN GEEFT (API hernoemd in een update):
 *    1. verwijder dit bestand,
 *    2. verwijder de regel "CreativeTab.initialize();" uit ModMain,
 *    3. vraag de AI in de chat om een fix → die zet ik in ai-code/.
 */
public final class CreativeTab {
    private CreativeTab() {}

    public static void initialize() {
        CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.BUILDING_BLOCKS)
                .register(tab -> {
                    tab.accept(ModBlocks.GLITCHBENCH.asItem());
                    tab.accept(ModBlocks.FARLANDS_GLITCH_PART.asItem());
                });

        CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.INGREDIENTS)
                .register(tab -> {
                    tab.accept(ModItems.GLITCH_TEXTURE);
                    tab.accept(ModItems.MIJN_ITEM_2);
                    tab.accept(ModItems.G_LI_TCH_SPAWN_EGG);
                    tab.accept(ModItems.GLITCHDRANKJE);
                    tab.accept(ModItems.GLITCHDRANKJE_SPLASH);
                    tab.accept(ModItems.GLITCHDRANKJE_LINGERING);
                    tab.accept(ModItems.GLITCHDRANKJE_ARROW);
                });
    }
}
