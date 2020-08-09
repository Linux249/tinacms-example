import React from 'react';
import styled, { css } from 'styled-components';
import LineChartComponent from '../components/charts/LineChart';
import { ScatterChart } from '../components/charts/ScatterChart';
import ParentSize from '@vx/responsive/lib/components/ParentSize';

const StyledContent = styled.div`
    ${(props) =>
        props.center &&
        css`
            text-align: center;
        `};
`;

export function LineChart({ data }) {
    console.log('LineChartData', data);
    const centered = data.center ? data.center : false;
    try {
        data.lineChart = JSON.parse(data.lineChart);
    } catch (e) {
        console.log('Paring chart Data Error - ', data, e);
    }
    return (
        <StyledContent center={centered}>
            <h2>{data.labelY}</h2>
            <ParentSize>
                {({ width }) => <ScatterChart width={width} height={400} />}
            </ParentSize>
            ,
            <LineChartComponent rawData={data} />
        </StyledContent>
    );
}

export const LineChartBlock = {
    label: 'LineChart',
    name: 'lineChart',
    key: 'line-chart',
    defaultItem: {
        data: '{"data": []}',
        labelX: '',
        labelY: '',
    },
    fields: [
        { name: 'labelX', label: 'Label X', component: 'text' },
        { name: 'labelY', label: 'Label Y', component: 'text' },
        { name: 'lineChart', label: 'LineChart', component: 'textarea' },
    ],
};
