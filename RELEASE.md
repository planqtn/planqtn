# Release process

1. Create a tag with the next release following the [versioning policy](./VERSIONING.md)
2. Create a release note:

- Follow the draft release note creation process here with a pregenerated release note: https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
- Add in breaking changes for the python library
- Provide a brief summary of awesome new features based on the PR list generated
- Acknowledge and thank all the contributors for this release
- Have someone review the draft

3. Hit publish - this should create the tag and publish, check them

- the [planqtn Docker images](https://hub.docker.com/u/planqtn),
- the [`planqtn-cli` npm package](https://www.npmjs.com/package/planqtn-cli),
- the [`planqtn` pypi package](https://pypi.org/project/planqtn)

7. Deploy to staging using the `Deploy to Staging` workflow and the new tag and do some light manual testing, check for the new features.
8. If everything looks good, deploy to prod using the `Deploy to Production` workflow.
9. Send out the celebratory message on Social media.
