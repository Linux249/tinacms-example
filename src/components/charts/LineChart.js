import React, { useEffect, useRef, useState } from 'react';
import moize from 'moize';
import { Motion, spring } from 'react-motion';
import { bisector, extent, max } from 'd3-array';
import { AxisBottom, AxisLeft } from '@vx/axis';
import { scaleLinear, scaleTime } from '@vx/scale';
import { Line, LinePath } from '@vx/shape';
import { curveBasis } from '@vx/curve';
import { GridRows } from '@vx/grid';
import { Group } from '@vx/group';
import { withParentSize } from '@vx/responsive';
import { localPoint, touchPoint } from '@vx/event';
import ToolTip from './ToolTip';

export const colors = ['rgb(107, 157, 255)', 'rgb(252, 137, 159)'];
export const margin = { top: 10, left: 60, bottom: 50, right: 5 };

// memoizing components improves performance from 30fps to 50+fps on 5x throttled cpu
const GridRowsMem = moize.reactSimple(GridRows);
const GroupMem = moize.reactSimple(Group);
const LinePathMem = moize.reactSimple(LinePath);
const AxisLeftMem = moize.reactSimple(AxisLeft);
const AxisBottomMem = moize.reactSimple(AxisBottom);

// Todo describe shortly what this du
const bisectDate = bisector((d) => new Date(d.date)).left;

const getX = (d) => d.date;
const getY = (d) => d.value;

const pathYCache = {};

function Delay(props) {
    const { children, initial, period } = props;
    const [value, setValue] = useState(initial);

    useEffect(() => {
        const timeout = setTimeout(() => setValue(props.value), period);
        return () => clearTimeout(timeout);
    }, []);

    return children(value);
}

export function findPathYatX(x, path, name, error) {
    const key = `${name}-${x}`;

    if (key in pathYCache) {
        return pathYCache[key];
    }

    error = error || 0.01;

    const maxIterations = 100;

    let lengthStart = 0;
    let lengthEnd = path.getTotalLength();
    let point = path.getPointAtLength((lengthEnd + lengthStart) / 2);
    let iterations = 0;

    while (x < point.x - error || x > point.x + error) {
        const midpoint = (lengthStart + lengthEnd) / 2;

        point = path.getPointAtLength(midpoint);

        if (x < point.x) {
            lengthEnd = midpoint;
        } else {
            lengthStart = midpoint;
        }

        iterations += 1;
        if (maxIterations < iterations) {
            break;
        }
    }

    pathYCache[key] = point.y;

    return pathYCache[key];
}

const CurrentLine = ({
    vertLineLeft = 0,
    show = false,
    height = 0,
    data = [],
    getPathYFromX = () => {},
}) => (
    <>
        <Motion
            defaultStyle={{ left: 0, opacity: 0 }}
            style={{
                left: spring(vertLineLeft),
                opacity: spring(show ? 0.12 : 0),
            }}
        >
            {(style) => (
                <Line
                    from={{ x: style.left, y: 0 }}
                    to={{ x: style.left, y: height }}
                    stroke="rgb(25, 29, 34)"
                    opacity={style.opacity}
                />
            )}
        </Motion>

        <Motion
            defaultStyle={{ opacity: 0, x: vertLineLeft }}
            style={{
                opacity: spring(show ? 1 : 0),
                x: spring(vertLineLeft),
            }}
        >
            {(style) => (
                <g>
                    {data.map((d, i) => {
                        const y = getPathYFromX(i, style.x);
                        return (
                            <g key={i}>
                                <circle
                                    cx={style.x}
                                    cy={y}
                                    r={12}
                                    fill={colors[i]}
                                    stroke={colors[i]}
                                    strokeWidth=".6"
                                    fillOpacity={style.opacity / 12}
                                    strokeOpacity={style.opacity / 2}
                                />
                                <circle
                                    cx={style.x}
                                    cy={y}
                                    r={4}
                                    fill="white"
                                    stroke={colors[i]}
                                    strokeWidth="1.5"
                                    fillOpacity={style.opacity}
                                    strokeOpacity={style.opacity}
                                />
                            </g>
                        );
                    })}
                </g>
            )}
        </Motion>
    </>
);

export const LineTooltip = ({
    parentWidth,
    parentHeight,
    value: url,
    rawData,
}) => {
    const tooltipRef = useRef(null);
    const svgRef = useRef(null);
    const linesRef = useRef([]);

    const labelX = rawData.labelX;
    const labelY = rawData.labelY;

    // todo handle getting chart data error
    // const { data: rawData, error } = useSWR(url, (u) =>
    //     fetch(u).then((r) => r.json())
    // );
    const [data, setData] = useState([]);
    // needed for iterator through all points
    const [allData, setAllData] = useState([]);

    const [vertLineLeft, setVertLineLeft] = useState(0);

    const [tooltip, setTooltip] = useState({
        open: false,
        top: 0,
        left: 0,
        data: [],
    });

    const aspectRatio = 1 / 2;
    const width = parentWidth;
    const height = parentWidth / 2;

    const xMax = parentWidth - margin.left - margin.right;
    const yMax = parentWidth * aspectRatio - margin.top - margin.bottom;

    // only change high computation after data changes
    useEffect(() => {
        console.log('PARSING DATA', rawData);
        if (rawData) {
            setAllData(
                rawData.lineChart.data.reduce(
                    (a, c) =>
                        a.concat(
                            c.map((e) => (e.date = new Date(e.date)) && e),
                        ),
                    [],
                ),
            );
            setData(
                rawData.lineChart.data.map((s) =>
                    s.map((e) => (e.date = new Date(e.date)) && e),
                ),
            );
        }
    }, [rawData]);

    const xScale = scaleTime({
        domain: extent(allData, getX),
    });
    const yScale = scaleLinear({
        domain: [0, max(allData, getY)],
    });

    // update scale output ranges
    xScale.range([0, xMax]);
    yScale.range([yMax, 0]);

    const yScaleFormat = yScale.tickFormat(3, '0');

    const showTooltipAt = (x, y) => {
        const positionX = x - margin.left;
        const positionY = y - margin.top;

        if (
            positionX < 0 ||
            positionX > xMax ||
            positionY < 0 ||
            positionY > yMax
        ) {
            console.log(
                'mouse out of bount, close',
                positionX,
                positionY,
                xMax,
                yMax,
            );
            return setTooltip({ open: false, ...tooltip });
        }

        const tooltipWidth = tooltipRef.current.getBoundingClientRect().width;

        const dataPoints = data.map((d) => {
            const xDomain = xScale.invert(x - margin.left);

            const index = bisectDate(d, xDomain, 1);
            const dLeft = d[index - 1];
            const dRight = d[index];

            const isRightCloser =
                dRight &&
                xDomain - new Date(dLeft.date) >
                    new Date(dRight.date) - xDomain;

            return isRightCloser ? dRight : dLeft;
        });
        // console.log(dataPoints);

        const xOffset = 18;
        const yOffset = 18;

        const positionXWithOffset = positionX + xOffset;
        const pastRightSide = positionXWithOffset + tooltipWidth > xMax;
        const left = pastRightSide
            ? positionX - tooltipWidth - xOffset
            : positionXWithOffset;

        const top = positionY - yOffset;

        setTooltip({ open: true, top, left, data: dataPoints });
        setVertLineLeft(xScale(new Date(dataPoints[0].date)));
    };

    const getPathYFromX = (index, x) => {
        const path = linesRef.current[index];
        return findPathYatX(x, path, index);
    };

    function handleMouseLeave() {
        console.log('handleMouseLeave');
        return setTooltip({ open: false, ...tooltip });
    }

    const handleTouchMove = (event) => {
        const { x, y } = touchPoint(svgRef.current, event);
        // console.log('handleTouchMove', x, y);
        showTooltipAt(x, y);
    };

    const handleMouseMove = (event) => {
        const { x, y } = localPoint(svgRef.current, event);
        // console.log('handleMouseMove', x, y);
        showTooltipAt(x, y);
    };

    if (!rawData) return <div>No LineChart data for path: {url}</div>;

    return (
        <div style={{ position: 'relative' }}>
            <svg width={width} height={height} ref={svgRef}>
                <rect x={0} y={0} width={width} height={height} fill="white" />

                <GridRowsMem
                    top={margin.top}
                    left={margin.left}
                    scale={yScale}
                    numTicks={3}
                    width={xMax}
                />

                <GroupMem top={margin.top} left={margin.left}>
                    {data.map((seriesData, i) => (
                        <LinePathMem
                            key={i}
                            data-index={i}
                            data={seriesData}
                            x={(d) => xScale(getX(d))}
                            y={(d) => yScale(getY(d))}
                            curve={curveBasis}
                            stroke={colors[i]}
                            strokeLinecap="round"
                            innerRef={(el) => (linesRef.current[i] = el)}
                        />
                    ))}

                    <CurrentLine
                        vertLineLeft={vertLineLeft}
                        height={yMax}
                        data={tooltip.data}
                        show={tooltip.open}
                        getPathYFromX={getPathYFromX}
                    />

                    <rect
                        x="0"
                        y="0"
                        width={xMax}
                        height={yMax}
                        fill="transparent"
                        onMouseLeave={handleMouseLeave}
                        onMouseMove={handleMouseMove}
                        onTouchMove={handleTouchMove}
                    />

                    <Delay initial={0} value={xMax} period={300}>
                        {(delayed) => (
                            <Motion
                                defaultStyle={{ x: 0 }}
                                style={{ x: spring(delayed) }}
                            >
                                {(style) => (
                                    <rect
                                        x={style.x}
                                        y="0"
                                        width={Math.max(xMax - style.x, 0)}
                                        height={yMax}
                                        fill="white"
                                    />
                                )}
                            </Motion>
                        )}
                    </Delay>
                </GroupMem>

                <AxisLeftMem
                    label={labelY}
                    top={margin.top}
                    left={margin.left}
                    scale={yScale}
                    hideTicks
                    hideAxisLine
                    numTicks={3}
                    // stroke="#eaf0f6"
                    tickFormat={yScaleFormat}
                    tickLabelProps={(p) => ({
                        ...p,
                        fontSize: 10,
                        fill: 'rgba(25, 29, 34, 0.6)',
                        textAnchor: 'middle',
                    })}
                />
                <AxisBottomMem
                    label={labelX}
                    top={height - margin.bottom}
                    left={margin.left}
                    scale={xScale}
                    hideTicks
                    stroke="#eaf0f6"
                    tickLabelProps={(p) => ({
                        ...p,
                        fontSize: 10,
                        fill: 'rgba(25, 29, 34, 0.6)',
                        textAnchor: 'middle',
                    })}
                />
            </svg>

            <ToolTip
                tooltip={tooltip}
                tooltipRef={tooltipRef}
                width={xMax}
                height={yMax}
            />
        </div>
    );
};

export default withParentSize(LineTooltip);
