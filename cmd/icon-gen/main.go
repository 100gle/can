package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/jpeg"
	"image/png"
	"os"
)

func main() {
	if len(os.Args) < 3 {
		println("Usage: go run main.go <input.png|jpg> <output.ico>")
		os.Exit(1)
	}

	// Read image file
	imgData, err := os.ReadFile(os.Args[1])
	if err != nil {
		println("Error reading input:", err.Error())
		os.Exit(1)
	}

	// Decode image to get dimensions
	img, format, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		println("Error decoding image:", err.Error())
		os.Exit(1)
	}

	// Re-encode as PNG for ICO embedding
	var pngBuf bytes.Buffer
	if err := png.Encode(&pngBuf, img); err != nil {
		println("Error encoding to PNG:", err.Error())
		os.Exit(1)
	}
	pngData := pngBuf.Bytes()

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// ICO files use 0 for 256
	icoWidth := uint8(width)
	icoHeight := uint8(height)
	if width >= 256 {
		icoWidth = 0
	}
	if height >= 256 {
		icoHeight = 0
	}

	// Build ICO file
	var ico bytes.Buffer

	// ICONDIR header
	binary.Write(&ico, binary.LittleEndian, uint16(0)) // Reserved
	binary.Write(&ico, binary.LittleEndian, uint16(1)) // Type: 1 = ICO
	binary.Write(&ico, binary.LittleEndian, uint16(1)) // Number of images

	// ICONDIRENTRY
	ico.WriteByte(icoWidth)                                       // Width
	ico.WriteByte(icoHeight)                                      // Height
	ico.WriteByte(0)                                              // Color palette
	ico.WriteByte(0)                                              // Reserved
	binary.Write(&ico, binary.LittleEndian, uint16(1))            // Color planes
	binary.Write(&ico, binary.LittleEndian, uint16(32))           // Bits per pixel
	binary.Write(&ico, binary.LittleEndian, uint32(len(pngData))) // Size of image data
	binary.Write(&ico, binary.LittleEndian, uint32(22))           // Offset to image data (6 + 16)

	// PNG data
	ico.Write(pngData)

	// Write ICO file
	if err := os.WriteFile(os.Args[2], ico.Bytes(), 0644); err != nil {
		println("Error writing output:", err.Error())
		os.Exit(1)
	}

	println("Icon converted successfully from", format, "to ICO:", os.Args[2])
}

func init() {
	image.RegisterFormat("png", "\x89PNG", png.Decode, png.DecodeConfig)
	image.RegisterFormat("jpeg", "\xff\xd8", jpeg.Decode, jpeg.DecodeConfig)
}
