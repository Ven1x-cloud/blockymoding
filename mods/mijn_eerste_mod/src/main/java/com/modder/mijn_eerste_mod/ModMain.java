package com.modder.mijn_eerste_mod;

import net.fabricmc.api.ModInitializer;
import net.minecraft.resources.ResourceLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Hoofdklasse van Mijn eerste Mod – gegenereerd door BlockyMod Studio.
 * Doelversie: Minecraft 26.3 (officiële Mojang-mappings).
 */
public class ModMain implements ModInitializer {
    public static final String MOD_ID = "mijn_eerste_mod";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static ResourceLocation id(String path) {
        return ResourceLocation.fromNamespaceAndPath(MOD_ID, path);
    }

    @Override
    public void onInitialize() {
        ModBlocks.initialize();
        ModItems.initialize();
        ModEntities.initialize();
        ModEffects.initialize();
        gui.ModScreenHandlers.initialize();
        CreativeTab.initialize(); // ⚠️ zie CreativeTab.java
        story.StoryEvents.register();

        LOGGER.info("[{}] geïnitialiseerd – veel bouwplezier!", MOD_ID);
    }
}
