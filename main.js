const { app, core, action } = require('photoshop')
const { localFileSystem } = require('uxp').storage

document
  .getElementById('generateCanvas')
  .addEventListener('click', createCanvas)
document
  .getElementById('exportFavicons')
  .addEventListener('click', exportFavicons)

/**
 * Creates a new 46x46 pixel canvas
 */
async function createCanvas() {
  try {
    await core.executeAsModal(
      async () => {
        const result = await app.createDocument({
          width: 46,
          height: 46,
          resolution: 72,
          mode: 'RGBColorMode',
          fill: 'white',
        })
        console.log('Canvas created successfully')
      },
      { commandName: 'Create Favicon Canvas' }
    )
  } catch (error) {
    console.error('Failed to create canvas:', error)
  }
}

/**
 * Export favicons with correct sizing and proper cleanup
 */
async function exportFavicons() {
  if (!app.activeDocument) {
    core.showAlert('Please create or open a document first')
    return
  }

  try {
    const folder = await localFileSystem.getFolder()
    if (!folder) {
      core.showAlert('No folder selected')
      return
    }

    await core.executeAsModal(
      async () => {
        const originalDoc = app.activeDocument
        let tempDoc = null

        try {
          // Create output files
          const light2x = await folder.createFile('light@2x.png', {
            overwrite: true,
          })
          const dark2x = await folder.createFile('dark@2x.png', {
            overwrite: true,
          })
          const light1x = await folder.createFile('light@1x.png', {
            overwrite: true,
          })
          const dark1x = await folder.createFile('dark@1x.png', {
            overwrite: true,
          })

          // Create additional output files with simplified names
          const light = await folder.createFile('light.png', {
            overwrite: true,
          })
          const dark = await folder.createFile('dark.png', { overwrite: true })

          // Step 1: Save light@2x.png (46x46)
          console.log('Saving light@2x.png at 46x46')
          await originalDoc.saveAs.png(light2x)

          // Step 2: Create dark version and save dark@2x.png (46x46)
          console.log('Creating dark version at 46x46')
          tempDoc = await originalDoc.duplicate()

          // Apply invert adjustment for dark version
          await action.batchPlay(
            [
              {
                _obj: 'invert',
                _target: [{ _ref: 'document', _id: tempDoc.id }],
              },
            ],
            { synchronousExecution: true }
          )

          // Save dark@2x version (46x46)
          await tempDoc.saveAs.png(dark2x)

          // Close the dark version temporary document using correct method
          await tempDoc.close('no') // 'no' means don't save changes
          tempDoc = null

          // Step 3: Create 23x23 version for light@1x.png
          console.log('Creating and saving light@1x.png and light.png at 23x23')
          tempDoc = await originalDoc.duplicate()
          await tempDoc.resizeImage(23, 23)
          await tempDoc.saveAs.png(light1x)

          // Save additional copy as light.png
          await tempDoc.saveAs.png(light)
          console.log('Saved additional light.png file')

          await tempDoc.close('no')
          tempDoc = null

          // Step 4: Create 23x23 version for dark@1x.png
          console.log('Creating and saving dark@1x.png and dark.png at 23x23')
          tempDoc = await originalDoc.duplicate()

          // First invert colors
          await action.batchPlay(
            [
              {
                _obj: 'invert',
                _target: [{ _ref: 'document', _id: tempDoc.id }],
              },
            ],
            { synchronousExecution: true }
          )

          // Then resize to 23x23
          await tempDoc.resizeImage(23, 23)
          await tempDoc.saveAs.png(dark1x)

          // Save additional copy as dark.png
          await tempDoc.saveAs.png(dark)
          console.log('Saved additional dark.png file')
          
          await tempDoc.close('no')
          tempDoc = null

          const files = await folder.getEntries()
          core.showAlert(
            `Successfully exported 4 favicon files to:\n${folder.nativePath}`
          )
        } catch (err) {
          console.error('Error in export process:', err)

          // Make sure to close any temporary document if an error occurs
          if (tempDoc) {
            await tempDoc.close('no')
          }

          throw err
        }
      },
      { commandName: 'Export Favicons' }
    )
  } catch (error) {
    console.error('Export error:', error)
    core.showAlert(`Export failed: ${error.message}`)
  }
}
