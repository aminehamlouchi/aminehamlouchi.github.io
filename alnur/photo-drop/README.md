# Alnur Photo Drop

Upload approved community photos here when you want them to start showing on the homepage gallery at alnurmasjid.org.

Use JPG, PNG, or WebP files. Newer photos are weighted higher on the website, but older photos still stay in the rotation.

Optional: put photos in subfolders named things like `quran`, `youth`, `halaqa`, `sprouts`, or `meals` if you want the homepage label to match that kind of program.

After you upload photos to this folder on GitHub and commit the change, GitHub Actions rebuilds `alnur/gallery.json` and the optimized gallery images automatically.

## How to Upload Photos

1. Go to the GitHub repository.
2. Open `alnur/photo-drop`.
3. Click `Add file`, then `Upload files`.
4. Drag in approved JPG, PNG, or WebP photos.
5. Click `Commit changes`.
6. Wait a few minutes for the `Build Alnur gallery` workflow to finish.

Once the workflow finishes, the homepage gallery will start using the new photos automatically. Newer photos are more likely to appear, but older approved photos remain in the rotation.

## How Others Can Upload

Invite trusted people to this GitHub repository with write access. Once they accept the invite, they can use the same upload steps above.

Use this for people who are allowed to publish approved photos only. Anyone with write access can change repository files, so keep the uploader list small and trusted.
