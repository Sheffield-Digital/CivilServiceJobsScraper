# Civil Service Jobs → Sheffield Digital

A Chrome extension that scrapes a job listing from [Civil Service Jobs](https://www.civilservicejobs.service.gov.uk/) and posts it directly to the [Sheffield Digital job board](https://sheffield.digital/jobs/) via the API.

## Installation

1. Download **CivilServiceJobsScraper.zip** from this repository and unzip it.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the unzipped folder.
5. The extension icon will appear in your Chrome toolbar.

## Setup

Before posting jobs you need to add your Sheffield Digital API credentials:

1. Click the extension icon and then **Settings** (or right-click the icon and choose **Options**).
2. Enter your Sheffield Digital **username** and **API key**.
3. Click **Save settings**.

Contact [info@sheffield.digital](mailto:info@sheffield.digital) to request API access if you don't have credentials yet.

## Usage

1. Navigate to a job detail page on [civilservicejobs.service.gov.uk](https://www.civilservicejobs.service.gov.uk/).
2. Click the extension icon — it will extract the job details automatically.
3. Review the extracted fields and description.
4. Click **Post to Sheffield Digital** to submit the listing for approval.

The job will appear in the [Sheffield Digital job dashboard](https://sheffield.digital/jobs/job-dashboard/) pending review before it goes live.

## Requirements

- Google Chrome (or any Chromium-based browser that supports Manifest V3 extensions)
- A Sheffield Digital website account with API access
