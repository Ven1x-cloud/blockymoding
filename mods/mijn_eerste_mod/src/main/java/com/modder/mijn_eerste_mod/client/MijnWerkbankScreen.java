package com.modder.mijn_eerste_mod.client;

import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.Slot;
import pkg.ModMain;
import pkg.gui.MijnWerkbankMenu;

/**
 * Scherm voor "glitchbench" – tekent je zelf-ontworpen GUI-textuur.
 */
@Environment(EnvType.CLIENT)
public class MijnWerkbankScreen extends AbstractContainerScreen<MijnWerkbankMenu> {
    private static final ResourceLocation TEXTURE = ModMain.id("textures/gui/mijn_werkbank.png");

    public MijnWerkbankScreen(MijnWerkbankMenu menu, Inventory inventory, Component title) {
        super(menu, inventory, title);
        this.imageWidth = 176;
        this.imageHeight = 166;
        this.titleLabelX = 4000; // verberg de standaard-titel (wij tekenen onze eigen labels)
    }

    @Override
    protected void init() {
        super.init();
        this.addRenderableWidget(Button.builder(Component.literal(">"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + 78, this.topPos + 44, 25, 10).build());

    }

    @Override
    protected void renderBg(GuiGraphics g, float partialTick, int mouseX, int mouseY) {
        g.blit(TEXTURE, this.leftPos, this.topPos, 0, 0, this.imageWidth, this.imageHeight);
        g.drawString(this.font, "Mijn Werkbank", this.leftPos + 8, this.topPos + 7, 0x404040, false);
    }

    @Override
    protected void renderSlot(GuiGraphics g, Slot slot) {
        // De slot-achtergrond zit al in je eigen textuur – teken alleen het item.
        g.renderItem(slot.getItem(), slot.x, slot.y);
        g.renderItemDecorations(this.font, slot.getItem(), slot.x, slot.y);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float delta) {
        super.render(g, mouseX, mouseY, delta);
        this.renderTooltip(g, mouseX, mouseY);
    }
}
