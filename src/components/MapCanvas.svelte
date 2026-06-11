<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Konva from 'konva';
  import type { MapFragment, Annotation, AssemblyScheme, ToolType, Point } from '@/types';
  import { SYSTEM_CONFIG } from '@/types';
  import { appStore } from '@/lib/store';
  import { getFragmentCenter, getSpliceRelations } from '@/lib/utils';

  export let scheme: AssemblyScheme | null = null;
  export let selectedFragmentId: string | null = null;
  export let selectedAnnotationId: string | null = null;
  export let activeTool: ToolType = 'select';
  export let readOnly: boolean = false;
  export let viewportScale: number = 1;
  export let viewportX: number = 0;
  export let viewportY: number = 0;

  const dispatch = createEventDispatcher<{
    fragmentSelect: string | null;
    fragmentTransform: { id: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number };
    fragmentDblClick: string;
    annotationSelect: string | null;
    annotationCreate: { type: string; fragmentId: string; data: Record<string, unknown> };
    canvasClick: { x: number; y: number };
    viewportChange: { scale: number; x: number; y: number };
  }>();

  let container: HTMLDivElement | null = null;
  let stage: Konva.Stage | null = null;
  let layer: Konva.Layer | null = null;
  let annotationLayer: Konva.Layer | null = null;
  let spliceRelationLayer: Konva.Layer | null = null;
  let transformer: Konva.Transformer | null = null;
  let images: Map<string, HTMLImageElement> = new Map();
  let nodes: Map<string, Konva.Node> = new Map();
  let annotationNodes: Map<string, Konva.Node> = new Map();
  let spliceRelationNodes: Map<string, Konva.Node> = new Map();
  let drawingPoints: Point[] = [];
  let tempLine: Konva.Line | null = null;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let showSpliceRelations = true;

  const getFragmentLayer = () => layer;
  const getAnnotationLayer = () => annotationLayer;

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const existing = images.get(src);
      if (existing && existing.complete) {
        resolve(existing);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        images.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  function createFragmentNode(fragment: MapFragment): Konva.Image | null {
    const img = images.get(fragment.imageSrc);
    if (!img) return null;

    const node = new Konva.Image({
      id: `frag-${fragment.id}`,
      image: img,
      x: fragment.x,
      y: fragment.y,
      width: fragment.originalWidth,
      height: fragment.originalHeight,
      rotation: fragment.rotation,
      scaleX: fragment.scaleX,
      scaleY: fragment.scaleY,
      opacity: fragment.visible ? fragment.opacity : 0,
      draggable: !readOnly && activeTool === 'select' && fragment.visible,
    });

    node.on('dragend', () => {
      dispatch('fragmentTransform', {
        id: fragment.id,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    });

    node.on('transformend', () => {
      dispatch('fragmentTransform', {
        id: fragment.id,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    });

    node.on('click tap', (e) => {
      e.cancelBubble = true;
      if (activeTool === 'select') {
        dispatch('fragmentSelect', fragment.id);
      } else if (activeTool.startsWith('annotate-')) {
        handleAnnotationClick(e, fragment);
      }
    });

    node.on('dblclick dbltap', (e) => {
      e.cancelBubble = true;
      dispatch('fragmentDblClick', fragment.id);
    });

    return node;
  }

  function handleAnnotationClick(e: Konva.KonvaEventObject<MouseEvent>, fragment: MapFragment) {
    const tool = activeTool;
    const ptr = e.target.getStage()?.getPointerPosition();
    if (!ptr) return;

    const local = { x: ptr.x, y: ptr.y };

    if (tool === 'annotate-place' || tool === 'annotate-note') {
      const type = tool === 'annotate-place' ? 'place' : 'note';
      dispatch('annotationCreate', {
        type,
        fragmentId: fragment.id,
        data: { position: local },
      });
      appStore.setActiveTool('select');
    } else if (tool === 'annotate-river' || tool === 'annotate-boundary') {
      drawingPoints.push(local);
      updateTempLine();
      if (drawingPoints.length >= 2 && e.evt?.shiftKey) {
        const type = tool === 'annotate-river' ? 'river' : 'boundary';
        dispatch('annotationCreate', {
          type,
          fragmentId: fragment.id,
          data: { points: [...drawingPoints], closed: type === 'boundary' },
        });
        clearDrawing();
        appStore.setActiveTool('select');
      }
    }
  }

  function updateTempLine() {
    if (tempLine) {
      tempLine.points(drawingPoints.flatMap((p) => [p.x, p.y]) as number[]);
      annotationLayer?.batchDraw();
    } else if (annotationLayer && drawingPoints.length > 0) {
      const isRiver = activeTool === 'annotate-river';
      tempLine = new Konva.Line({
        points: drawingPoints.flatMap((p) => [p.x, p.y]) as number[],
        stroke: isRiver ? '#2563eb' : '#9333ea',
        strokeWidth: isRiver ? 3 : 2,
        lineCap: 'round',
        lineJoin: 'round',
        dash: isRiver ? [] : [5, 5],
        opacity: 0.8,
      });
      annotationLayer.add(tempLine);
    }
  }

  function clearDrawing() {
    drawingPoints = [];
    if (tempLine) {
      tempLine.destroy();
      tempLine = null;
    }
    annotationLayer?.batchDraw();
  }

  function createAnnotationNode(annotation: Annotation): Konva.Node | null {
    let node: Konva.Node | null = null;

    switch (annotation.type) {
      case 'place': {
        const group = new Konva.Group({ id: `ann-${annotation.id}` });
        const circle = new Konva.Circle({
          x: annotation.position.x,
          y: annotation.position.y,
          radius: 6,
          fill: annotation.color,
          stroke: '#fff',
          strokeWidth: 2,
        });
        const label = new Konva.Text({
          x: annotation.position.x + 10,
          y: annotation.position.y - 8,
          text: annotation.label,
          fontSize: 14,
          fontFamily: 'Noto Serif SC, serif',
          fill: annotation.color,
          fontStyle: 'bold',
        });
        const bg = new Konva.Rect({
          x: label.x() - 2,
          y: label.y(),
          width: label.width() + 4,
          height: label.height(),
          fill: 'rgba(255,255,255,0.9)',
          cornerRadius: 2,
        });
        group.add(circle);
        group.add(bg);
        group.add(label);
        node = group;
        break;
      }
      case 'river': {
        node = new Konva.Line({
          id: `ann-${annotation.id}`,
          points: annotation.points.flatMap((p) => [p.x, p.y]) as number[],
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
          opacity: 0.85,
        });
        break;
      }
      case 'boundary': {
        node = new Konva.Line({
          id: `ann-${annotation.id}`,
          points: annotation.points.flatMap((p) => [p.x, p.y]) as number[],
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          dash: [8, 4],
          lineCap: 'round',
          lineJoin: 'round',
          closed: annotation.closed,
          opacity: 0.85,
        });
        break;
      }
      case 'note': {
        const group = new Konva.Group({ id: `ann-${annotation.id}` });
        const label = new Konva.Text({
          x: annotation.position.x,
          y: annotation.position.y,
          text: annotation.label,
          fontSize: annotation.fontSize,
          fontFamily: 'Noto Serif SC, serif',
          fill: annotation.color,
          fontStyle: '500',
        });
        const padding = 4;
        const bg = new Konva.Rect({
          x: label.x() - padding,
          y: label.y() - padding,
          width: label.width() + padding * 2,
          height: label.height() + padding * 2,
          fill: 'rgba(253, 252, 249, 0.95)',
          stroke: annotation.color,
          strokeWidth: 1,
          cornerRadius: 4,
        });
        group.add(bg);
        group.add(label);
        node = group;
        break;
      }
    }

    if (node && !readOnly) {
      node.on('click tap', (e) => {
        e.cancelBubble = true;
        dispatch('annotationSelect', annotation.id);
      });
    }

    return node;
  }

  async function renderFragments() {
    if (!layer || !scheme) return;

    const validImages = scheme.fragments.filter((f) => images.has(f.imageSrc));
    const missing = scheme.fragments.filter((f) => !images.has(f.imageSrc));

    for (const f of missing) {
      try {
        await loadImage(f.imageSrc);
      } catch (e) {
        console.error('加载图片失败', f.name, e);
      }
    }

    layer.destroyChildren();
    nodes.clear();

    const sorted = [...scheme.fragments].sort((a, b) => a.zIndex - b.zIndex);
    for (const frag of sorted) {
      const node = createFragmentNode(frag);
      if (node) {
        layer.add(node);
        nodes.set(frag.id, node);
      }
    }

    if (transformer) {
      layer.add(transformer);
      updateTransformerSelection();
    }

    layer.batchDraw();
  }

  function renderAnnotations() {
    if (!annotationLayer || !scheme) return;

    annotationLayer.destroyChildren();
    annotationNodes.clear();

    for (const ann of scheme.annotations) {
      const node = createAnnotationNode(ann);
      if (node) {
        annotationLayer.add(node);
        annotationNodes.set(ann.id, node);
      }
    }

    if (tempLine) {
      annotationLayer.add(tempLine);
    }

    annotationLayer.batchDraw();
  }

  function renderSpliceRelations() {
    if (!spliceRelationLayer || !scheme || !showSpliceRelations) {
      spliceRelationLayer?.destroyChildren();
      spliceRelationNodes.clear();
      spliceRelationLayer?.batchDraw();
      return;
    }

    spliceRelationLayer.destroyChildren();
    spliceRelationNodes.clear();

    const relations = getSpliceRelations(scheme);

    for (const rel of relations) {
      const fromCenter = getFragmentCenter(rel.fromFragment);
      const toCenter = getFragmentCenter(rel.toFragment);

      const isHighlighted = selectedFragmentId === rel.fromFragmentId || selectedFragmentId === rel.toFragmentId;

      const midX = (fromCenter.x + toCenter.x) / 2;
      const midY = (fromCenter.y + toCenter.y) / 2;

      const lineGroup = new Konva.Group({ id: `splice-${rel.id}` });

      const line = new Konva.Line({
        points: [fromCenter.x, fromCenter.y, toCenter.x, toCenter.y],
        stroke: isHighlighted ? '#16a34a' : '#22c55e',
        strokeWidth: isHighlighted ? 3 : 2,
        lineCap: 'round',
        lineJoin: 'round',
        dash: isHighlighted ? [] : [8, 4],
        opacity: isHighlighted ? 0.9 : 0.6,
      });

      const circle1 = new Konva.Circle({
        x: fromCenter.x,
        y: fromCenter.y,
        radius: isHighlighted ? 6 : 4,
        fill: isHighlighted ? '#16a34a' : '#22c55e',
        stroke: '#fff',
        strokeWidth: 2,
        opacity: isHighlighted ? 0.9 : 0.6,
      });

      const circle2 = new Konva.Circle({
        x: toCenter.x,
        y: toCenter.y,
        radius: isHighlighted ? 6 : 4,
        fill: isHighlighted ? '#16a34a' : '#22c55e',
        stroke: '#fff',
        strokeWidth: 2,
        opacity: isHighlighted ? 0.9 : 0.6,
      });

      const labelBg = new Konva.Rect({
        x: midX - 30,
        y: midY - 10,
        width: 60,
        height: 20,
        fill: isHighlighted ? 'rgba(22, 163, 74, 0.95)' : 'rgba(34, 197, 94, 0.8)',
        cornerRadius: 4,
        opacity: isHighlighted ? 1 : 0,
      });

      const label = new Konva.Text({
        x: midX - 30,
        y: midY - 6,
        width: 60,
        text: '已拼接',
        fontSize: 11,
        fontFamily: 'Noto Serif SC, serif',
        fill: '#fff',
        align: 'center',
        opacity: isHighlighted ? 1 : 0,
      });

      lineGroup.add(line);
      lineGroup.add(circle1);
      lineGroup.add(circle2);
      lineGroup.add(labelBg);
      lineGroup.add(label);

      lineGroup.on('mouseenter', () => {
        line.stroke('#16a34a');
        line.strokeWidth(3);
        line.dash([]);
        line.opacity(0.9);
        circle1.radius(6);
        circle1.fill('#16a34a');
        circle1.opacity(0.9);
        circle2.radius(6);
        circle2.fill('#16a34a');
        circle2.opacity(0.9);
        labelBg.opacity(1);
        label.opacity(1);
        if (stage) stage.container().style.cursor = 'pointer';
        if (spliceRelationLayer) spliceRelationLayer.batchDraw();
      });

      lineGroup.on('mouseleave', () => {
        const shouldHighlight = selectedFragmentId === rel.fromFragmentId || selectedFragmentId === rel.toFragmentId;
        line.stroke(shouldHighlight ? '#16a34a' : '#22c55e');
        line.strokeWidth(shouldHighlight ? 3 : 2);
        line.dash(shouldHighlight ? [] : [8, 4]);
        line.opacity(shouldHighlight ? 0.9 : 0.6);
        circle1.radius(shouldHighlight ? 6 : 4);
        circle1.fill(shouldHighlight ? '#16a34a' : '#22c55e');
        circle1.opacity(shouldHighlight ? 0.9 : 0.6);
        circle2.radius(shouldHighlight ? 6 : 4);
        circle2.fill(shouldHighlight ? '#16a34a' : '#22c55e');
        circle2.opacity(shouldHighlight ? 0.9 : 0.6);
        labelBg.opacity(0);
        label.opacity(0);
        if (stage) stage.container().style.cursor = 'default';
        if (spliceRelationLayer) spliceRelationLayer.batchDraw();
      });

      lineGroup.on('click tap', (e) => {
        e.cancelBubble = true;
        dispatch('fragmentSelect', rel.fromFragmentId);
      });

      spliceRelationLayer.add(lineGroup);
      spliceRelationNodes.set(rel.id, lineGroup);
    }

    spliceRelationLayer.batchDraw();
  }

  function updateTransformerSelection() {
    if (!transformer || !layer || !scheme) return;

    if (selectedFragmentId && !readOnly) {
      const node = nodes.get(selectedFragmentId);
      if (node && node instanceof Konva.Image) {
        transformer.nodes([node]);
        transformer.rotateEnabled(true);
        transformer.enabledAnchors([
          'top-left', 'top-right', 'bottom-left', 'bottom-right',
          'middle-left', 'middle-right', 'top-center', 'bottom-center'
        ]);
        transformer.boundBoxFunc((_, newBox) => {
          newBox.rotation = Math.max(
            SYSTEM_CONFIG.MIN_ROTATION,
            Math.min(SYSTEM_CONFIG.MAX_ROTATION, newBox.rotation)
          );
          const minDim = 10;
          const maxDim = 10000;
          newBox.width = Math.max(minDim, Math.min(maxDim, newBox.width));
          newBox.height = Math.max(minDim, Math.min(maxDim, newBox.height));
          return newBox;
        });
      } else {
        transformer.nodes([]);
      }
    } else {
      transformer.nodes([]);
    }

    layer.batchDraw();
  }

  function highlightSelectedAnnotation() {
    if (!scheme) return;
    for (const [id, node] of annotationNodes) {
      if (id === selectedAnnotationId) {
        if (node instanceof Konva.Line) {
          node.strokeWidth((node.strokeWidth() || 1) + 2);
        }
      }
    }
    annotationLayer?.batchDraw();
  }

  function handleWheel(e: WheelEvent) {
    if (!stage) return;
    e.preventDefault();
    const oldScale = stage.scaleX();
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const mousePointTo = {
      x: (ptr.x - stage.x()) / oldScale,
      y: (ptr.y - stage.y()) / oldScale,
    };
    const direction = e.deltaY > 0 ? -1 : 1;
    const scaleBy = 1.05;
    const newScale = Math.max(0.1, Math.min(10, oldScale * (direction > 0 ? scaleBy : 1 / scaleBy)));
    const newX = ptr.x - mousePointTo.x * newScale;
    const newY = ptr.y - mousePointTo.y * newScale;
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: newX, y: newY });
    stage.batchDraw();
    dispatch('viewportChange', { scale: newScale, x: newX, y: newY });
  }

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target === e.target.getStage()) {
      if (activeTool === 'select' || activeTool === 'pan') {
        dispatch('fragmentSelect', null);
        dispatch('annotationSelect', null);
      }
      if (activeTool === 'pan') {
        isPanning = true;
        const pos = stage?.getPointerPosition();
        if (pos && stage) {
          panStart = { x: pos.x - stage.x(), y: pos.y - stage.y() };
          stage.container().style.cursor = 'grabbing';
        }
      }
    }
  }

  function handleStageMouseMove() {
    if (isPanning && stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        stage.position({ x: pos.x - panStart.x, y: pos.y - panStart.y });
        stage.batchDraw();
      }
    }
  }

  function handleStageMouseUp() {
    if (isPanning && stage) {
      dispatch('viewportChange', { scale: stage.scaleX(), x: stage.x(), y: stage.y() });
    }
    isPanning = false;
    if (stage) {
      stage.container().style.cursor = activeTool === 'pan' ? 'grab' : 'default';
    }
  }

  function resize() {
    if (!stage || !container) return;
    stage.width(container.clientWidth);
    stage.height(container.clientHeight);
    stage.batchDraw();
  }

  $: scheme, scheme && renderFragments();
  $: scheme && scheme.fragments.length && renderFragments();

  $: scheme, scheme && renderAnnotations();
  $: scheme && scheme.annotations.length && renderAnnotations();

  $: scheme, scheme && renderSpliceRelations();
  $: scheme && scheme.fragments.length && renderSpliceRelations();
  $: selectedFragmentId, renderSpliceRelations();
  $: showSpliceRelations, renderSpliceRelations();

  $: selectedFragmentId, scheme, updateTransformerSelection();

  $: selectedAnnotationId, scheme, (highlightSelectedAnnotation(), renderAnnotations());

  $: activeTool, stage && (() => {
    stage.container().style.cursor = activeTool === 'pan' ? 'grab' : 'default';
    for (const [id, node] of nodes) {
      if (node instanceof Konva.Image) {
        node.draggable(!readOnly && activeTool === 'select');
      }
    }
  })();

  $: if (activeTool !== 'annotate-river' && activeTool !== 'annotate-boundary') clearDrawing();

  $: viewportScale, viewportX, viewportY, stage && (() => {
    stage.scale({ x: viewportScale, y: viewportScale });
    stage.position({ x: viewportX, y: viewportY });
    stage.batchDraw();
  })();

  onMount(() => {
    if (!container) return;

    stage = new Konva.Stage({
      container: container,
      width: container.clientWidth,
      height: container.clientHeight,
    });

    layer = new Konva.Layer();
    annotationLayer = new Konva.Layer();
    spliceRelationLayer = new Konva.Layer();
    stage.add(layer);
    stage.add(annotationLayer);
    stage.add(spliceRelationLayer);

    transformer = new Konva.Transformer({
      rotateAnchorOffset: 30,
      anchorSize: 10,
      borderStroke: '#b1893d',
      borderStrokeWidth: 1.5,
      anchorStroke: '#b1893d',
      anchorFill: '#fff',
      anchorStrokeWidth: 1.5,
    });
    layer.add(transformer);

    stage.scale({ x: viewportScale, y: viewportScale });
    stage.position({ x: viewportX, y: viewportY });

    stage.on('wheel', handleWheel);
    stage.on('mousedown touchstart', handleStageMouseDown);
    stage.on('mousemove touchmove', handleStageMouseMove);
    stage.on('mouseup touchend', handleStageMouseUp);

    window.addEventListener('resize', resize);
    resize();
    renderFragments();
    renderAnnotations();
    renderSpliceRelations();
  });

  onDestroy(() => {
    window.removeEventListener('resize', resize);
    stage?.destroy();
  });
</script>

<div
  bind:this={container}
  class="w-full h-full bg-parchment-100 rounded-lg overflow-hidden relative"
  style="background-image:
    linear-gradient(rgba(193, 154, 107, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(193, 154, 107, 0.08) 1px, transparent 1px);
    background-size: 20px 20px;"
>
  {#if !readOnly && scheme && scheme.fragments.some(f => f.isMatched)}
    <button
      class="absolute top-3 right-3 z-10 px-3 py-1.5 text-xs rounded-md shadow-md transition-all"
      class:bg-parchment-600={showSpliceRelations}
      class:text-white={showSpliceRelations}
      class:bg-white={!showSpliceRelations}
      class:text-ink-600={!showSpliceRelations}
      class:border={!showSpliceRelations}
      class:border-parchment-300={!showSpliceRelations}
      on:click={() => (showSpliceRelations = !showSpliceRelations)}
      title={showSpliceRelations ? '隐藏拼接关系' : '显示拼接关系'}
    >
      🔗 {showSpliceRelations ? '隐藏' : '显示'}拼接关系
    </button>
  {/if}
</div>
