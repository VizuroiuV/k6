import http from 'k6/http';
import { check, fail, group } from 'k6';
import { Trend } from 'k6/metrics';

import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

import { expect } from 'https://www.chaijs.com/chai.js';

const EXPECTED_CARS = ['Ford Fiesta', 'BMW X5', 'Porsche 911', 'Lamborghini'];

// Custom Trends: Time To First Byte
const ttfbLoginTrend = new Trend('LOGIN_TTFB');
const ttfbCarsTrend = new Trend('CARS_TTFB');

const isResponseValid = (response, expectedResponseBody) =>
  check(
    response,
    {
      'status was 200': r => r.status == 200,
      'valid body': r =>
        expect(JSON.parse(r.body)).to.deep.equal(expectedResponseBody),
    },
    {
      myTag: 'VALID_RESPONSE',
    },
  );

const logResponse = response => {
  console.log(
    `@@@@@ Response metrics @@@@@\n ${JSON.stringify(
      response,
      null,
      2,
    )} \n@@@@@@@@@@`,
  );
};

const login = (username, password) =>
  http.post(
    `https://qatools.ro/api/login.php?username=${username}&password=${password}`,
  );

const getCars = accessToken =>
  http.get(`https://qatools.ro/api/cars`, {
    headers: { 'Access-Token': accessToken },
  });

const validateLogin = loginResponse => {
  if (!isResponseValid(loginResponse, { status: 'authorized' })) {
    fail('Login failed');
  }
  check(loginResponse, {
    'Access-Token was sent': t =>
      expect(loginResponse.headers['Access-Token']).to.be.a('string').and.not
        .empty,
  });
};

const validateCars = carsResponse => {
  if (!isResponseValid(carsResponse, EXPECTED_CARS)) {
    fail('Getting cars failed');
  }
};

// ***** EXPORTS *****

export const options = {
  //httpDebug: 'full',
  vus: 2,
  iterations: 2,
};

export default function () {
  let accessToken;
  group('LOGIN', () => {
    const loginResponse = login('tester', 'passw0rd');
    ttfbLoginTrend.add(loginResponse.timings.waiting);

    accessToken = loginResponse.headers['Access-Token'];

    validateLogin(loginResponse);

    // logResponse(loginResponse);
  });

  group('CARS', () => {
    const carsResponse = getCars(accessToken);
    ttfbCarsTrend.add(carsResponse.timings.waiting);

    validateCars(carsResponse);

    // logResponse(carsResponse);
  });
}

export function handleSummary(data) {
  return {
    'reports/summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
