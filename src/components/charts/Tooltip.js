import { Motion, spring } from 'react-motion';
import React from 'react';
import styled from 'styled-components';

const options = { year: 'numeric', month: 'long', day: 'numeric' };

export const localDate = (date) =>
    new Date(date).toLocaleDateString('de-DE', options);
export const colors = ['rgb(107, 157, 255)', 'rgb(252, 137, 159)'];
export const margin = { top: 10, left: 20, bottom: 30, right: 5 };

const Tooltip = styled.div`
    position: absolute;
    background-color: white;
    color: rgba(25, 29, 34, 0.54);
    padding: 12px;
    font-size: 14px;
    box-shadow: 0 4px 8px 0 rgba(25, 29, 34, 0.1);
    pointer-events: none;
    border-radius: 3px;
    border: 1px solid rgba(25, 29, 34, 0.12);
`;

export const ToolTip = ({ tooltip, width, height, tooltipRef }) => {
    return (
        <div
            style={{
                position: 'absolute',
                top: margin.top,
                left: margin.left,
                width,
                height,
                pointerEvents: 'none',
            }}
        >
            <Motion
                defaultStyle={{
                    left: tooltip.left,
                    top: tooltip.top,
                    opacity: 0,
                }}
                style={{
                    left: spring(tooltip.left),
                    top: spring(tooltip.top),
                    opacity: spring(tooltip.open ? 1 : 0),
                }}
            >
                {(style) => (
                    <Tooltip
                        ref={tooltipRef}
                        style={{
                            top: style.top,
                            left: style.left,
                            opacity: style.opacity,
                        }}
                    >
                        <div>
                            <strong>
                                {tooltip.data.length &&
                                    localDate(tooltip.data[0].date)}
                            </strong>
                            {tooltip.data.map((d, i) => (
                                <div key={i}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            borderRadius: '50%',
                                            width: 8,
                                            height: 8,
                                            marginRight: 6,
                                            backgroundColor: colors[i],
                                        }}
                                    />
                                    {d.value}
                                </div>
                            ))}
                        </div>
                    </Tooltip>
                )}
            </Motion>
        </div>
    );
};

export default ToolTip;
