import Promise from 'bluebird';
import sizeOf from 'image-size';
import Canvas from 'canvas';
import { computeRowLayout } from './layouts/justified';
import { findIdealNodeSearch } from './utils/findIdealNodeSearch';
import { getPhoto } from './utils/photo';

function getRowLayout(photos, containerWidth, columnsCount, targetRowHeight = 300, spacing = 0) {
  let limitNodeSearch = 2;

  if (containerWidth >= 450) {
    limitNodeSearch = findIdealNodeSearch({ containerWidth, targetRowHeight });
  }

  const thumbs = computeRowLayout({
    containerWidth,
    limitNodeSearch: columnsCount || limitNodeSearch,
    targetRowHeight,
    margin: 0,
    photos,
  });

  const rows = [];
  let currentRow = [];
  let width = 0;

  thumbs.forEach((thumb) => {
    if (Math.round(width + thumb.width) > containerWidth) {
      rows.push(currentRow);
      currentRow = [];
      width = thumb.width;
    } else {
      width += thumb.width;
    }
    currentRow.push(thumb);
  });

  if (currentRow.length == 1) {
    currentRow[0].width += spacing;
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return rows;
}

function getCanvasWidth(rows, spacing) {
  const additionalSpace = (Math.ceil(rows[0].length / 2) * spacing) + (spacing * 2);
  return rows[0].reduce((width, element) => width + element.width, 0) + additionalSpace;
}

function getCanvasHeight(rows, spacing) {
  const additionalSpace = (Math.ceil(rows.length / 2) * spacing) + (rows.length > 1 ? spacing * 2 : spacing);
  return rows.reduce((height, row) => height + row[0].height, 0) + additionalSpace;
}

function getPositions(rows, spacing = 0) {
  let y = spacing;

  return rows.map((row) => {
    // let x = row.length > 1 || spacing == 0 ? 0 : spacing / 2;
    let x = spacing;
    const position = row.map((thumb) => {
      const thumbX = x;
      x += thumb.width + spacing;
      return { x: thumbX, y };
    });
    y += row[0].height + spacing;
    return position;
  });
}

// eslint-disable-next-line import/prefer-default-export
export async function createCollage(sources, maxWidth, columnsCount, mimeType = 'image/png') {
  const spacing = 10;
  const photos = await Promise.all(sources.map(getPhoto));
  const sizes = await Promise.all(photos.map(sizeOf));
  const photosWithSizes = photos.map((photo, index) => ({
    photo,
    ...sizes[index],
  }));
  const rows = getRowLayout(photosWithSizes, maxWidth, columnsCount, 300, spacing);
  const canvasHeight = getCanvasHeight(rows, spacing);
  const canvasWidth = getCanvasWidth(rows, spacing);
  const positions = getPositions(rows, spacing);

  const canvasCollage = Canvas.createCanvas(canvasWidth, canvasHeight);
  const ctx = canvasCollage.getContext('2d');

  rows.forEach((row, i) => {
    row.forEach(({ height, width, photo }, j) => {
      const img = new Canvas.Image();
      const { x, y } = positions[i][j];
      img.src = photo;
      ctx.drawImage(img, x, y, width, height);
    });
  });

  return canvasCollage.toBuffer(mimeType);
}
