(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('ol/control/Control'), require('ol/Observable'), require('ol/layer/Group')) :
	typeof define === 'function' && define.amd ? define(['ol/control/Control', 'ol/Observable', 'ol/layer/Group'], factory) :
	(global.LayerSwitcher = factory(global.ol.control.Control,global.ol.Observable,global.ol.layer.Group));
}(this, (function (Control,ol_Observable,LayerGroup) { 'use strict';

Control = 'default' in Control ? Control['default'] : Control;
LayerGroup = 'default' in LayerGroup ? LayerGroup['default'] : LayerGroup;

/**
 * @protected
 */
const CSS_PREFIX = 'layer-switcher-';
/**
 * OpenLayers LayerSwitcher Control, muestra una lista de capas y grupos 
 * asociados a un mapa que tienen una propiedad `title`.
 * Para que se muestren en el panel LayerSwitcher, las capas deben tener 
 * una propiedad `title`; las capas de mapa base deben tener una propiedad `type` 
 * establecida en `base`. Las capas de grupo (`LayerGroup`) se pueden utilizar 
 * para agrupar capas visualmente; un grupo con una propiedad `fold` establecida 
 * a `'open'` o `'close'` se mostrará con un conmutador.
 *
 * Ver [BaseLayerOptions](#baselayeroptions) para una lista completa de propiedades LayerSwitcher 
 * para capas (`TileLayer`, `ImageLayer`, `VectorTile` etc.) y [GroupLayerOptions](#grouplayeroptions) 
 * para propiedades LayerSwitcher de capas de grupo (`LayerGroup`).
 *
 * Las propiedades de las capas y los grupos pueden establecerse añadiendo 
 * propiedades adicionales a sus opciones cuando se crean o a través de su método set.
 *
 * Especifique un `title` para una Capa añadiendo una propiedad `title` a su objeto options:
 * ```javascript
 * var lyr = new ol.layer.Tile({
 *   // Especifique una propiedad de título que mostrará el conmutador de capas
 *   title: 'OpenStreetMap',
 *   visible: true,
 *   source: new ol.source.OSM()
 * })
 * ```
 *
 * Alternativamente, las propiedades se pueden establecer a través del método `set` después de crear una capa:
 * ```javascript
 * var lyr = new ol.layer.Tile({
 *   visible: true,
 *   source: new ol.source.OSM()
 * })
 * // Especifique una propiedad de título que mostrará el conmutador de capas
 * lyr.set('title', 'OpenStreetMap');
 * ```
 *
 * Para crear un LayerSwitcher y añadirlo a un mapa, crea una nueva instancia y pásala al método [`addControl`] del mapa (https://openlayers.org/en/latest/apidoc/module-ol_Map-Map.html#addControl).
 * ```javascript
 * var layerSwitcher = new LayerSwitcher({
 *   reverse: true,
 *   groupSelectStyle: 'group'
 * });
 * map.addControl(layerSwitcher);
 * ```
 *
 * @constructor
 * @extends {ol/control/Control~Control}
 * @param opt_options LayerSwitcher options, see  [LayerSwitcher Options](#options) and [RenderOptions](#renderoptions) which LayerSwitcher `Options` extends for more details.
 */
class LayerSwitcher extends Control {
    constructor(opt_options) {
        const options = Object.assign({}, opt_options);
        const element = document.createElement('div');
        super({ element: element, target: options.target });
		// Puede ser 'click' o 'mouseover'.
        this.activationMode = options.activationMode || 'mouseover';
        this.startActive = options.startActive === true;
        // TODO Next: Rename to showButtonContent
        this.label = options.label !== undefined ? options.label : '';
        // TODO Next: Rename to hideButtonContent
        this.collapseLabel =
            options.collapseLabel !== undefined ? options.collapseLabel : '\u00BB';
        // TODO Next: Rename to showButtonTitle
        this.tipLabel = options.tipLabel ? options.tipLabel : 'Legend';
        // TODO Next: Rename to hideButtonTitle
        this.collapseTipLabel = options.collapseTipLabel
            ? options.collapseTipLabel
            : 'Collapse legend';
        this.groupSelectStyle = LayerSwitcher.getGroupSelectStyle(options.groupSelectStyle);
        this.reverse = options.reverse !== false;
        this.mapListeners = [];
        this.hiddenClassName = 'ol-unselectable ol-control layer-switcher';
        if (LayerSwitcher.isTouchDevice_()) {
            this.hiddenClassName += ' touch';
        }
        this.shownClassName = 'shown';
        element.className = this.hiddenClassName;
        this.button = document.createElement('button');
        element.appendChild(this.button);
        this.panel = document.createElement('div');
        this.panel.className = 'panel';
        element.appendChild(this.panel);
        LayerSwitcher.enableTouchScroll_(this.panel);
        element.classList.add(CSS_PREFIX + 'group-select-style-' + this.groupSelectStyle);
        element.classList.add(CSS_PREFIX + 'activation-mode-' + this.activationMode);
        if (this.activationMode === 'click') {
            // TODO Next: Remove in favour of layer-switcher-activation-mode-click
            element.classList.add('activationModeClick');
            this.button.onclick = (e) => {
                const evt = e || window.event;
                if (this.element.classList.contains(this.shownClassName)) {
                    this.hidePanel();
                }
                else {
                    this.showPanel();
                }
                evt.preventDefault();
            };
        }
        else {
            this.button.onmouseover = () => {
                this.showPanel();
            };
            this.button.onclick = (e) => {
                const evt = e || window.event;
                this.showPanel();
                evt.preventDefault();
            };
            this.panel.onmouseout = (evt) => {
                if (!this.panel.contains(evt.relatedTarget)) {
                    this.hidePanel();
                }
            };
        }
        this.updateButton();
    }
    /**
     * Establece la instancia de map a la que está asociado el control.
     * @param map The map instance.
     */
    setMap(map) {
        // Clean up listeners associated with the previous map
        for (let i = 0; i < this.mapListeners.length; i++) {
            ol_Observable.unByKey(this.mapListeners[i]);
        }
        this.mapListeners.length = 0;
        // Wire up listeners etc. and store reference to new map
        super.setMap(map);
        if (map) {
            if (this.startActive) {
                this.showPanel();
            }
            else {
                this.renderPanel();
            }
            if (this.activationMode !== 'click') {
                this.mapListeners.push(map.on('pointerdown', () => {
                    this.hidePanel();
                }));
            }
        }
    }
    /**
     * Muestra el panel de capas. Dispara el evento `'show'`.
     * @fires LayerSwitcher#show
     */
    showPanel() {
        if (!this.element.classList.contains(this.shownClassName)) {
            this.element.classList.add(this.shownClassName);
            this.updateButton();
            this.renderPanel();
        }
        /**
         * Evento que se activa después de mostrar el panel.
         * Escucha el evento a través de los métodos `on` o `once`; por ejemplo:
         * ```js
         * var layerSwitcher = new LayerSwitcher();
         * map.addControl(layerSwitcher);
         *
         * layerSwitcher.on('show', evt => {
         *   console.log('show', evt);
         * });
         * @event LayerSwitcher#show
         */
        this.dispatchEvent('show');
    }
    /**
     * Oculta el panel de capas. Dispara el evento `'hide'`.
     * @fires LayerSwitcher#hide
     */
    hidePanel() {
        if (this.element.classList.contains(this.shownClassName)) {
            this.element.classList.remove(this.shownClassName);
            this.updateButton();
        }
        /**
         * Event triggered after the panel has been hidden.
         * @event LayerSwitcher#hide
         */
        this.dispatchEvent('hide');
    }
    /**
     * Actualizar el contenido y los atributos del texto del botón en función del estado actual
     */
    updateButton() {
        if (this.element.classList.contains(this.shownClassName)) {
            this.button.textContent = this.collapseLabel;
            this.button.setAttribute('title', this.collapseTipLabel);
            this.button.setAttribute('aria-label', this.collapseTipLabel);
        }
        else {
            this.button.textContent = this.label;
            this.button.setAttribute('title', this.tipLabel);
            this.button.setAttribute('aria-label', this.tipLabel);
        }
    }
    /**
     * Vuelve a dibujar el panel de capas para representar el estado actual de las capas.
     */
    renderPanel() {
        this.dispatchEvent('render');
        LayerSwitcher.renderPanel(this.getMap(), this.panel, {
            groupSelectStyle: this.groupSelectStyle,
            reverse: this.reverse
        });
        this.dispatchEvent('rendercomplete');
    }
    /**
     * **_[static]_** - Re-draw the layer panel to represent the current state of the layers.
     * @param map The OpenLayers Map instance to render layers for
     * @param panel The DOM Element into which the layer tree will be rendered
     * @param options Options for panel, group, and layers
     */
    static renderPanel(map, panel, options) {
        // Create the event.
        const render_event = new Event('render');
        // Dispatch the event.
        panel.dispatchEvent(render_event);
        options = options || {};
        options.groupSelectStyle = LayerSwitcher.getGroupSelectStyle(options.groupSelectStyle);
        LayerSwitcher.ensureTopVisibleBaseLayerShown(map, options.groupSelectStyle);
        while (panel.firstChild) {
            panel.removeChild(panel.firstChild);
        }
        // Reset indeterminate state for all layers and groups before
        // applying based on groupSelectStyle
        LayerSwitcher.forEachRecursive(map, function (l, _idx, _a) {
            l.set('indeterminate', false);
        });
        if (options.groupSelectStyle === 'children' ||
            options.groupSelectStyle === 'none') {
            // Set visibile and indeterminate state of groups based on
            // their children's visibility
            LayerSwitcher.setGroupVisibility(map);
        }
        else if (options.groupSelectStyle === 'group') {
            // Set child indetermiate state based on their parent's visibility
            LayerSwitcher.setChildVisibility(map);
        }
        const ul = document.createElement('ul');
        panel.appendChild(ul);
        // passing two map arguments instead of lyr as we're passing the map as the root of the layers tree
        LayerSwitcher.renderLayers_(map, map, ul, options, function render(_changedLyr) {
            LayerSwitcher.renderPanel(map, panel, options);
        });
        // Create the event.
        const rendercomplete_event = new Event('rendercomplete');
        // Dispatch the event.
        panel.dispatchEvent(rendercomplete_event);
    }
    /**
     * **_[static]_** - Determine if a given layer group contains base layers
     * @param grp Group to test
     */
    static isBaseGroup(grp) {
        if (grp instanceof LayerGroup) {
            const lyrs = grp.getLayers().getArray();
            return lyrs.length && lyrs[0].get('type') === 'base';
        }
        else {
            return false;
        }
    }
    static setGroupVisibility(map) {
        // Get a list of groups, with the deepest first
        const groups = LayerSwitcher.getGroupsAndLayers(map, function (l) {
            return (l instanceof LayerGroup &&
                !l.get('combine') &&
                !LayerSwitcher.isBaseGroup(l));
        }).reverse();
        // console.log(groups.map(g => g.get('title')));
        groups.forEach(function (grp) {
            // TODO Can we use getLayersArray, is it public in the esm build?
            const descendantVisibility = grp.getLayersArray().map(function (l) {
                const state = l.getVisible();
                // console.log('>', l.get('title'), state);
                return state;
            });
            // console.log(descendantVisibility);
            if (descendantVisibility.every(function (v) {
                return v === true;
            })) {
                grp.setVisible(true);
                grp.set('indeterminate', false);
            }
            else if (descendantVisibility.every(function (v) {
                return v === false;
            })) {
                grp.setVisible(false);
                grp.set('indeterminate', false);
            }
            else {
                grp.setVisible(true);
                grp.set('indeterminate', true);
            }
        });
    }
    static setChildVisibility(map) {
        // console.log('setChildVisibility');
        const groups = LayerSwitcher.getGroupsAndLayers(map, function (l) {
            return (l instanceof LayerGroup &&
                !l.get('combine') &&
                !LayerSwitcher.isBaseGroup(l));
        });
        groups.forEach(function (grp) {
            const group = grp;
            // console.log(group.get('title'));
            const groupVisible = group.getVisible();
            const groupIndeterminate = group.get('indeterminate');
            group
                .getLayers()
                .getArray()
                .forEach(function (l) {
                l.set('indeterminate', false);
                if ((!groupVisible || groupIndeterminate) && l.getVisible()) {
                    l.set('indeterminate', true);
                }
            });
        });
    }
    /**
     * Ensure only the top-most base layer is visible if more than one is visible.
     * @param map The map instance.
     * @param groupSelectStyle
     * @protected
     */
    static ensureTopVisibleBaseLayerShown(map, groupSelectStyle) {
        let lastVisibleBaseLyr;
        LayerSwitcher.forEachRecursive(map, function (lyr, _idx, _arr) {
            if (lyr.get('type') === 'base' && lyr.getVisible()) {
                lastVisibleBaseLyr = lyr;
            }
        });
        if (lastVisibleBaseLyr)
            LayerSwitcher.setVisible_(map, lastVisibleBaseLyr, true, groupSelectStyle);
    }
    /**
     * **_[static]_** - Get an Array of all layers and groups displayed by the LayerSwitcher (has a `'title'` property)
     * contained by the specified map or layer group; optionally filtering via `filterFn`
     * @param grp The map or layer group for which layers are found.
     * @param filterFn Optional function used to filter the returned layers
     */
    static getGroupsAndLayers(grp, filterFn) {
        const layers = [];
        filterFn =
            filterFn ||
                function (_lyr, _idx, _arr) {
                    return true;
                };
        LayerSwitcher.forEachRecursive(grp, function (lyr, idx, arr) {
            if (lyr.get('title')) {
                if (filterFn(lyr, idx, arr)) {
                    layers.push(lyr);
                }
            }
        });
        return layers;
    }
    /**
     * Toggle the visible state of a layer.
     * Takes care of hiding other layers in the same exclusive group if the layer
     * is toggle to visible.
     * @protected
     * @param map The map instance.
     * @param lyr layer whose visibility will be toggled.
     * @param visible Set whether the layer is shown
     * @param groupSelectStyle
     * @protected
     */
    static setVisible_(map, lyr, visible, groupSelectStyle) {
        // console.log(lyr.get('title'), visible, groupSelectStyle);
        lyr.setVisible(visible);
        if (visible && lyr.get('type') === 'base') {
            // Hide all other base layers regardless of grouping
            LayerSwitcher.forEachRecursive(map, function (l, _idx, _arr) {
                if (l != lyr && l.get('type') === 'base') {
                    l.setVisible(false);
                }
            });
        }
        if (lyr instanceof LayerGroup &&
            !lyr.get('combine') &&
            groupSelectStyle === 'children') {
            lyr.getLayers().forEach((l) => {
                LayerSwitcher.setVisible_(map, l, lyr.getVisible(), groupSelectStyle);
            });
        }
    }
    /**
     * Render all layers that are children of a group.
     * @param map The map instance.
     * @param lyr Layer to be rendered (should have a title property).
     * @param idx Position in parent group list.
     * @param options Options for groups and layers
     * @protected
     */
    static renderLayer_(map, lyr, idx, options, render) {
        const li = document.createElement('li');
        const lyrTitle = lyr.get('title');
        const checkboxId = LayerSwitcher.uuid();
        const label = document.createElement('label');
        if (lyr instanceof LayerGroup && !lyr.get('combine')) {
            const isBaseGroup = LayerSwitcher.isBaseGroup(lyr);
            li.classList.add('group');
            if (isBaseGroup) {
                li.classList.add(CSS_PREFIX + 'base-group');
            }
            // Group folding
            if (lyr.get('fold')) {
                li.classList.add(CSS_PREFIX + 'fold');
                li.classList.add(CSS_PREFIX + lyr.get('fold'));
                const btn = document.createElement('button');
                btn.onclick = function (e) {
                    const evt = e || window.event;
                    LayerSwitcher.toggleFold_(lyr, li);
                    evt.preventDefault();
                };
                li.appendChild(btn);
            }
            if (!isBaseGroup && options.groupSelectStyle != 'none') {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = checkboxId;
                input.checked = lyr.getVisible();
                input.indeterminate = lyr.get('indeterminate');
                input.onchange = function (e) {
                    const target = e.target;
                    LayerSwitcher.setVisible_(map, lyr, target.checked, options.groupSelectStyle);
                    render(lyr);
                };
                li.appendChild(input);
                label.htmlFor = checkboxId;
            }
            label.innerHTML = lyrTitle;
            li.appendChild(label);
            const ul = document.createElement('ul');
            li.appendChild(ul);
            LayerSwitcher.renderLayers_(map, lyr, ul, options, render);
        }
        else {
            li.className = 'layer';
            const input = document.createElement('input');
            if (lyr.get('type') === 'base') {
                input.type = 'radio';
            }
            else {
                input.type = 'checkbox';
            }
            input.id = checkboxId;
            input.checked = lyr.get('visible');
            input.indeterminate = lyr.get('indeterminate');
            input.onchange = function (e) {
                const target = e.target;
                LayerSwitcher.setVisible_(map, lyr, target.checked, options.groupSelectStyle);
                render(lyr);
            };
            li.appendChild(input);
            label.htmlFor = checkboxId;
            label.innerHTML = lyrTitle;
            const rsl = map.getView().getResolution();
            if (rsl >= lyr.getMaxResolution() || rsl < lyr.getMinResolution()) {
                label.className += ' disabled';
            }
            else if (lyr.getMinZoom && lyr.getMaxZoom) {
                const zoom = map.getView().getZoom();
                if (zoom <= lyr.getMinZoom() || zoom > lyr.getMaxZoom()) {
                    label.className += ' disabled';
                }
            }
            li.appendChild(label);
        }
        return li;
    }
    /**
     * Render all layers that are children of a group.
     * @param map The map instance.
     * @param lyr Group layer whose children will be rendered.
     * @param elm DOM element that children will be appended to.
     * @param options Options for groups and layers
     * @protected
     */
    static renderLayers_(map, lyr, elm, options, render) {
        let lyrs = lyr.getLayers().getArray().slice();
        if (options.reverse)
            lyrs = lyrs.reverse();
        for (let i = 0, l; i < lyrs.length; i++) {
            l = lyrs[i];
            if (l.get('title')) {
                elm.appendChild(LayerSwitcher.renderLayer_(map, l, i, options, render));
            }
        }
    }
    /**
     * **_[static]_** - Call the supplied function for each layer in the passed layer group
     * recursing nested groups.
     * @param lyr The layer group to start iterating from.
     * @param fn Callback which will be called for each layer
     * found under `lyr`.
     */
    static forEachRecursive(lyr, fn) {
        lyr.getLayers().forEach(function (lyr, idx, a) {
            fn(lyr, idx, a);
            if (lyr instanceof LayerGroup) {
                LayerSwitcher.forEachRecursive(lyr, fn);
            }
        });
    }
    /**
     * **_[static]_** - Generate a UUID
     * Adapted from http://stackoverflow.com/a/2117523/526860
     * @returns {String} UUID
     */
    static uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0, v = c == 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
    /**
     * Apply workaround to enable scrolling of overflowing content within an
     * element. Adapted from https://gist.github.com/chrismbarr/4107472
     * @param elm Element on which to enable touch scrolling
     * @protected
     */
    static enableTouchScroll_(elm) {
        if (LayerSwitcher.isTouchDevice_()) {
            let scrollStartPos = 0;
            elm.addEventListener('touchstart', function (event) {
                scrollStartPos = this.scrollTop + event.touches[0].pageY;
            }, false);
            elm.addEventListener('touchmove', function (event) {
                this.scrollTop = scrollStartPos - event.touches[0].pageY;
            }, false);
        }
    }
    /**
     * Determine if the current browser supports touch events. Adapted from
     * https://gist.github.com/chrismbarr/4107472
     * @returns {Boolean} True if client can have 'TouchEvent' event
     * @protected
     */
    static isTouchDevice_() {
        try {
            document.createEvent('TouchEvent');
            return true;
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Fold/unfold layer group
     * @param lyr Layer group to fold/unfold
     * @param li List item containing layer group
     * @protected
     */
    static toggleFold_(lyr, li) {
        li.classList.remove(CSS_PREFIX + lyr.get('fold'));
        lyr.set('fold', lyr.get('fold') === 'open' ? 'close' : 'open');
        li.classList.add(CSS_PREFIX + lyr.get('fold'));
    }
    /**
     * If a valid groupSelectStyle value is not provided then return the default
     * @param groupSelectStyle The string to check for validity
     * @returns The value groupSelectStyle, if valid, the default otherwise
     * @protected
     */
    static getGroupSelectStyle(groupSelectStyle) {
        return ['none', 'children', 'group'].indexOf(groupSelectStyle) >= 0
            ? groupSelectStyle
            : 'children';
    }
}
// Expose LayerSwitcher as ol.control.LayerSwitcher if using a full build of
// OpenLayers
if (window['ol'] && window['ol']['control']) {
    window['ol']['control']['LayerSwitcher'] = LayerSwitcher;
}

return LayerSwitcher;

})));
